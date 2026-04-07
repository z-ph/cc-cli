const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const {
  loadConfig,
  saveConfig,
  findProfile,
  getLocalConfigPath,
  getGlobalConfigPath,
} = require('../config/loader');

const WORKER_PATH = path.join(__dirname, '..', 'proxy', 'worker.js');

/**
 * 生成随机 token
 */
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 通过 HTTP 健康检查验证代理进程是否存活
 */
function checkProxyAlive(proxy) {
  return new Promise((resolve) => {
    if (!proxy || !proxy.url || !proxy.token) {
      resolve(false);
      return;
    }
    const url = new URL('/__cc_proxy_status', proxy.url);
    url.searchParams.set('token', proxy.token);
    const req = http.get(url.toString(), (res) => {
      if (res.statusCode === 200) {
        res.resume();
        resolve(true);
      } else {
        res.resume();
        resolve(false);
      }
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 扫描配置中的所有 proxy 字段
 * 返回 { entries: [{ id, proxy, configPath, config, scope }], baseEntries: [{ proxy, configPath, config, scope }] }
 */
function scanProxies() {
  const entries = [];
  const baseEntries = [];

  const configs = [
    { configPath: getLocalConfigPath(), scope: '本地' },
    { configPath: getGlobalConfigPath(), scope: '全局' },
  ];

  for (const { configPath, scope } of configs) {
    const fs = require('fs');
    if (!fs.existsSync(configPath)) continue;
    const config = loadConfig(configPath);

    if (config.profiles) {
      for (const [id, profile] of Object.entries(config.profiles)) {
        if (profile.proxy) {
          entries.push({ id, proxy: profile.proxy, configPath, config, scope });
        }
      }
    }

    if (config.base && config.base.proxy) {
      baseEntries.push({ proxy: config.base.proxy, configPath, config, scope });
    }
  }

  return { entries, baseEntries };
}

/**
 * 从配置中删除 proxy 字段并保存
 */
function removeProxyFromConfig(configPath, config, target) {
  if (target === 'base') {
    delete config.base.proxy;
  } else {
    if (config.profiles && config.profiles[target]) {
      delete config.profiles[target].proxy;
    }
  }
  saveConfig(config, configPath);
}

/**
 * 启动代理服务
 */
async function startProxy(profileId, options) {
  const isBase = options?.base;

  if (!isBase && !profileId) {
    console.error('错误：请指定 profile ID 或使用 --base');
    process.exit(1);
  }

  // 查找 profile 或 base
  let targetConfig;
  let configPath;
  let targetName;

  if (isBase) {
    // 加载 base 配置
    const loadTarget = options?.target;
    if (loadTarget) {
      configPath = path.resolve(loadTarget);
      targetConfig = loadConfig(configPath);
    } else {
      // 优先本地，其次全局
      const localPath = getLocalConfigPath();
      const fs = require('fs');
      if (fs.existsSync(localPath)) {
        const localConfig = loadConfig(localPath);
        if (localConfig.base && Object.keys(localConfig.base).length > 0) {
          configPath = localPath;
          targetConfig = localConfig;
        }
      }
      if (!targetConfig) {
        configPath = getGlobalConfigPath();
        targetConfig = loadConfig(configPath);
      }
    }

    if (!targetConfig.base || Object.keys(targetConfig.base).length === 0) {
      console.error('错误：未找到 base 配置');
      process.exit(1);
    }

    targetName = 'base';
    var profile = targetConfig.base;
  } else {
    const result = findProfile(profileId, options?.target, { mergeBase: false });
    if (!result.profile) {
      console.error(`错误：未找到配置 '${profileId}'`);
      console.log('搜索路径：');
      console.log('  1. 当前目录: ./.claude/models.yaml');
      console.log('  2. 用户目录: ~/.claude/models.yaml');
      process.exit(1);
    }

    profile = result.profile;
    configPath = result.configPath;
    targetConfig = loadConfig(configPath);
    targetName = profileId;
  }

  // 校验 baseUrl（env.ANTHROPIC_BASE_URL）
  const baseUrl = profile?.env?.ANTHROPIC_BASE_URL;
  if (!baseUrl) {
    console.error(`错误：配置 '${targetName}' 缺少 env.ANTHROPIC_BASE_URL，无法启动代理`);
    process.exit(1);
  }

  // 重复启动保护
  if (profile.proxy) {
    const alive = await checkProxyAlive(profile.proxy);
    if (alive) {
      console.error(`代理已在运行中: ${profile.proxy.url}`);
      console.log(`请先执行 zcc serve stop ${isBase ? '' : profileId}`);
      process.exit(1);
    }
    // 进程已停止，清理旧 proxy 字段
    removeProxyFromConfig(configPath, targetConfig, targetName);
    // 重新加载配置
    if (isBase) {
      profile = loadConfig(configPath).base;
    } else {
      profile = loadConfig(configPath).profiles[profileId];
    }
  }

  // 生成 token
  const token = generateToken();

  // 构建代理配置
  const configDir = path.dirname(configPath);
  const proxyConfig = {
    baseUrl,
    modelOverride: profile.modelOverride || null,
    defaultModel: profile?.env?.ANTHROPIC_MODEL || null,
    token,
    profileId: targetName,
    configDir,
  };

  // 准备 stderr 重定向到日志文件
  const logsDir = path.join(configDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const logFilePath = path.join(logsDir, `proxy-${targetName}-${date}.log`);
  const logFd = fs.openSync(logFilePath, 'a');

  // 启动 worker 进程
  const child = fork(WORKER_PATH, [JSON.stringify(proxyConfig)], {
    detached: true,
    stdio: ['ignore', 'ignore', logFd, 'ipc'],
  });

  // 父进程不再需要 logFd
  fs.closeSync(logFd);

  // 等待 worker 就绪
  const readyPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('代理启动超时'));
    }, 10000);

    child.on('message', (msg) => {
      if (msg.type === 'ready') {
        clearTimeout(timeout);
        resolve(msg);
      } else if (msg.type === 'error') {
        clearTimeout(timeout);
        reject(new Error(msg.message));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`代理进程异常退出，code: ${code}`));
      }
    });
  });

  try {
    const { port } = await readyPromise;

    // 写入 proxy 字段
    const proxyField = {
      url: `http://localhost:${port}`,
      pid: child.pid,
      port,
      token,
    };

    // 重新加载配置避免覆盖
    const freshConfig = loadConfig(configPath);
    if (isBase) {
      if (!freshConfig.base) freshConfig.base = {};
      freshConfig.base.proxy = proxyField;
    } else {
      if (!freshConfig.profiles) freshConfig.profiles = {};
      if (!freshConfig.profiles[profileId]) freshConfig.profiles[profileId] = {};
      freshConfig.profiles[profileId].proxy = proxyField;
    }
    saveConfig(freshConfig, configPath);

    // 关闭 IPC 通道，分离子进程
    child.disconnect();
    child.unref();

    console.log(`代理已启动: ${proxyField.url} → ${baseUrl}`);

    // --run 模式：启动 Claude Code
    if (options?.run && !isBase) {
      console.log(`正在启动 Claude Code...`);
      const { launchCommand } = require('./launch');
      launchCommand(profileId, options);
    } else {
      process.exit(0);
    }
  } catch (err) {
    try { child.kill(); } catch {}
    console.error(`错误：代理启动失败 - ${err.message}`);
    process.exit(1);
  }
}

/**
 * 列出运行中的代理
 */
async function listProxies() {
  const { entries, baseEntries } = scanProxies();
  const allEntries = [
    ...entries.map(e => ({ ...e, displayId: e.id, isBase: false })),
    ...baseEntries.map(e => ({ ...e, displayId: 'base', isBase: true })),
  ];

  if (allEntries.length === 0) {
    console.log('没有找到代理服务记录');
    return;
  }

  console.log('代理服务列表：');

  for (const entry of allEntries) {
    const alive = await checkProxyAlive(entry.proxy);
    const status = alive ? '运行中' : '已停止';
    console.log(
      `  ${entry.displayId}    ${entry.proxy.url}    PID: ${entry.proxy.pid}    [${status}]    (${entry.scope})`
    );

    // 清理已停止的
    if (!alive) {
      removeProxyFromConfig(entry.configPath, entry.config, entry.isBase ? 'base' : entry.id);
    }
  }
}

/**
 * 停止指定代理
 */
async function stopProxy(profileId, options) {
  const isBase = options?.base;
  let configPath;
  let targetConfig;
  let targetName;
  let proxy;

  if (isBase) {
    // 搜索 base 配置
    const configs = [
      { path: getLocalConfigPath(), scope: '本地' },
      { path: getGlobalConfigPath(), scope: '全局' },
    ];
    const fs = require('fs');
    for (const c of configs) {
      if (fs.existsSync(c.path)) {
        const config = loadConfig(c.path);
        if (config.base && config.base.proxy) {
          configPath = c.path;
          targetConfig = config;
          proxy = config.base.proxy;
          targetName = 'base';
          break;
        }
      }
    }
  } else {
    if (!profileId) {
      console.error('错误：请指定 profile ID 或使用 --all 停止所有代理');
      process.exit(1);
    }
    const result = findProfile(profileId, options?.target, { mergeBase: false });
    if (!result.profile) {
      console.error(`错误：未找到配置 '${profileId}'`);
      process.exit(1);
    }
    configPath = result.configPath;
    targetConfig = loadConfig(configPath);
    proxy = targetConfig.profiles?.[profileId]?.proxy;
    targetName = profileId;
  }

  if (!proxy) {
    console.log(`配置 '${targetName}' 没有运行中的代理`);
    return;
  }

  // 终止进程
  try {
    process.kill(proxy.pid);
  } catch {
    // PID 不存在，静默处理
  }

  // 清理 proxy 字段
  removeProxyFromConfig(configPath, targetConfig, targetName);
  console.log(`代理已停止: ${proxy.url}`);
}

/**
 * 停止所有代理
 */
async function stopAllProxies() {
  const { entries, baseEntries } = scanProxies();
  const allEntries = [
    ...entries.map(e => ({ ...e, targetName: e.id, isBase: false })),
    ...baseEntries.map(e => ({ ...e, targetName: 'base', isBase: true })),
  ];

  if (allEntries.length === 0) {
    console.log('没有运行中的代理');
    return;
  }

  for (const entry of allEntries) {
    try {
      process.kill(entry.proxy.pid);
    } catch {
      // PID 不存在
    }
    removeProxyFromConfig(entry.configPath, entry.config, entry.isBase ? 'base' : entry.id);
    console.log(`代理已停止: ${entry.proxy.url}`);
  }
}

/**
 * 查看代理日志
 */
function logProxy(profileId, options) {
  options = options || {};
  const lines = options.lines || 20;

  // 确定要搜索的配置路径
  const configs = [
    { configPath: getLocalConfigPath(), scope: '本地' },
    { configPath: getGlobalConfigPath(), scope: '全局' },
  ];

  // 在配置文件同级 .claude/logs/ 下查找匹配的日志文件
  const candidates = [];
  for (const { configPath } of configs) {
    const logsDir = path.join(path.dirname(configPath), 'logs');
    if (!fs.existsSync(logsDir)) continue;
    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    for (const file of files) {
      if (file.startsWith(`proxy-${profileId}-`)) {
        candidates.push(path.join(logsDir, file));
      }
    }
  }

  if (candidates.length === 0) {
    console.log('暂无日志记录');
    return;
  }

  // 取最新的文件
  candidates.sort().reverse();
  const logFile = candidates[0];

  try {
    const content = fs.readFileSync(logFile, 'utf8');
    const allLines = content.trim().split('\n').filter(Boolean);
    const tail = allLines.slice(-lines);

    for (const line of tail) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'dropped') {
          console.log(`[${entry.ts}] --- 丢弃了 ${entry.count} 条日志 ---`);
          continue;
        }
        const modelInfo = entry.model
          ? `${entry.model} → ${entry.modelAfter}`
          : '';
        const streamTag = entry.stream ? '[stream]' : '';
        const errorTag = entry.error ? `[ERROR: ${entry.error}]` : '';
        const statusTag = entry.status ? `[${entry.status}]` : '';
        console.log(
          `[${entry.ts}] #${entry.id} ${entry.method} ${entry.path} ${streamTag} ${modelInfo} ${statusTag} ${entry.durationMs}ms ${errorTag}`
        );
      } catch {
        // 非 JSON 行直接输出
        console.log(line);
      }
    }
  } catch (err) {
    console.error(`读取日志文件失败: ${err.message}`);
  }
}

/**
 * serve 命令入口
 */
function serveCommand(action, id, options) {
  options = options || {};

  switch (action) {
    case 'list':
      listProxies();
      break;
    case 'stop':
      if (options.all) {
        stopAllProxies();
      } else {
        stopProxy(id, options);
      }
      break;
    case 'log':
      logProxy(id, options);
      break;
    default:
      // 无 action → 启动代理，action 实际上是 profile-id
      startProxy(action, options);
      break;
  }
}

module.exports = {
  serveCommand,
  checkProxyAlive,
};
