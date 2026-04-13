const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const yaml = require('js-yaml');
const { spawn } = require('child_process');
const {
  loadConfig,
  saveConfig,
  findProfile,
  getLocalConfigPath,
  getGlobalConfigPath,
} = require('../config/loader');

/**
 * 查找空闲端口
 */
function findAvailablePort(startPort = 3000) {
  return new Promise((resolve, reject) => {
    let port = startPort;

    const tryPort = () => {
      const server = http.createServer();
      server.listen(port, () => {
        server.close(() => {
          resolve(port);
        });
      });
      server.on('error', () => {
        port++;
        tryPort();
      });
    };

    tryPort();
  });
}

/**
 * 打开默认浏览器
 */
function openBrowser(url) {
  const { exec } = require('child_process');
  const cmd = process.platform === 'darwin'
    ? `open ${url}`
    : process.platform === 'win32'
    ? `start ${url}`
    : `xdg-open ${url}`;

  exec(cmd, (err) => {
    if (err) {
      console.log(`请手动访问：${url}`);
    }
  });
}

/**
 * 创建 Express 服务器
 */
function createServer() {
  const app = express();
  app.use(express.json());

  // 静态文件服务
  const publicPath = path.join(__dirname, '..', 'web', 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  // ============ API Routes ============

  // 获取完整配置
  app.get('/api/config', (req, res) => {
    try {
      const scope = req.query.scope || 'local';
      let configPath;

      if (scope === 'global') {
        configPath = getGlobalConfigPath();
      } else if (scope === 'local') {
        configPath = getLocalConfigPath();
      } else {
        configPath = scope;
      }

      if (!fs.existsSync(configPath)) {
        return res.json({
          success: true,
          data: {
            settings: { alias: 'zcc' },
            base: {},
            profiles: {},
          },
          configPath,
        });
      }

      const config = loadConfig(configPath);
      res.json({
        success: true,
        data: config,
        configPath,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 获取所有 profiles
  app.get('/api/profiles', (req, res) => {
    try {
      const scope = req.query.scope || 'local';
      let configPath;

      if (scope === 'global') {
        configPath = getGlobalConfigPath();
      } else {
        configPath = getLocalConfigPath();
      }

      if (!fs.existsSync(configPath)) {
        return res.json({ success: true, data: [] });
      }

      const config = loadConfig(configPath);
      const profiles = Object.entries(config.profiles || {}).map(([id, profile]) => ({
        id,
        ...profile,
      }));

      res.json({ success: true, data: profiles });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 获取单个 profile
  app.get('/api/profiles/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = findProfile(id, null, { mergeBase: false });

      if (!result.profile) {
        return res.status(404).json({
          success: false,
          error: `Profile '${id}' not found`,
        });
      }

      res.json({ success: true, data: result.profile });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 创建 profile
  app.post('/api/profiles', (req, res) => {
    try {
      const { id, ...profile } = req.body;
      const scope = req.query.scope || 'local';
      let configPath;

      if (scope === 'global') {
        configPath = getGlobalConfigPath();
      } else {
        configPath = getLocalConfigPath();
      }

      let config;
      if (fs.existsSync(configPath)) {
        config = loadConfig(configPath);
      } else {
        config = { settings: { alias: 'zcc' }, base: {}, profiles: {} };
      }

      if (!config.profiles) {
        config.profiles = {};
      }

      if (config.profiles[id]) {
        return res.status(400).json({
          success: false,
          error: `Profile '${id}' already exists`,
        });
      }

      config.profiles[id] = profile;
      saveConfig(config, configPath);

      res.json({
        success: true,
        message: `Profile '${id}' created`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 更新 profile
  app.put('/api/profiles/:id', (req, res) => {
    try {
      const { id } = req.params;
      const profile = req.body;
      const scope = req.query.scope || 'local';
      let configPath;

      if (scope === 'global') {
        configPath = getGlobalConfigPath();
      } else {
        configPath = getLocalConfigPath();
      }

      if (!fs.existsSync(configPath)) {
        return res.status(404).json({
          success: false,
          error: 'Config file not found',
        });
      }

      const config = loadConfig(configPath);

      if (!config.profiles || !config.profiles[id]) {
        return res.status(404).json({
          success: false,
          error: `Profile '${id}' not found`,
        });
      }

      config.profiles[id] = profile;
      saveConfig(config, configPath);

      res.json({
        success: true,
        message: `Profile '${id}' updated`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 删除 profile
  app.delete('/api/profiles/:id', (req, res) => {
    try {
      const { id } = req.params;
      const scope = req.query.scope || 'local';
      let configPath;

      if (scope === 'global') {
        configPath = getGlobalConfigPath();
      } else {
        configPath = getLocalConfigPath();
      }

      if (!fs.existsSync(configPath)) {
        return res.status(404).json({
          success: false,
          error: 'Config file not found',
        });
      }

      const config = loadConfig(configPath);

      if (!config.profiles || !config.profiles[id]) {
        return res.status(404).json({
          success: false,
          error: `Profile '${id}' not found`,
        });
      }

      delete config.profiles[id];
      saveConfig(config, configPath);

      res.json({
        success: true,
        message: `Profile '${id}' deleted`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 获取 base 配置
  app.get('/api/base', (req, res) => {
    try {
      const scope = req.query.scope || 'local';
      let configPath;

      if (scope === 'global') {
        configPath = getGlobalConfigPath();
      } else {
        configPath = getLocalConfigPath();
      }

      if (!fs.existsSync(configPath)) {
        return res.json({ success: true, data: {} });
      }

      const config = loadConfig(configPath);
      res.json({
        success: true,
        data: config.base || {},
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 更新 base 配置
  app.put('/api/base', (req, res) => {
    try {
      const base = req.body;
      const scope = req.query.scope || 'local';
      let configPath;

      if (scope === 'global') {
        configPath = getGlobalConfigPath();
      } else {
        configPath = getLocalConfigPath();
      }

      if (!fs.existsSync(configPath)) {
        // 创建新配置
        configPath = scope === 'global' ? getGlobalConfigPath() : getLocalConfigPath();
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        const config = { settings: { alias: 'zcc' }, base, profiles: {} };
        saveConfig(config, configPath);
      } else {
        const config = loadConfig(configPath);
        config.base = base;
        saveConfig(config, configPath);
      }

      res.json({
        success: true,
        message: 'Base config updated',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 获取原始 YAML
  app.get('/api/config/raw', (req, res) => {
    try {
      const scope = req.query.scope || 'local';
      let configPath;

      if (scope === 'global') {
        configPath = getGlobalConfigPath();
      } else {
        configPath = getLocalConfigPath();
      }

      if (!fs.existsSync(configPath)) {
        return res.json({
          success: true,
          data: '',
        });
      }

      const content = fs.readFileSync(configPath, 'utf8');
      res.json({
        success: true,
        data: content,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 导入配置（接收 JSON 或 YAML）
  app.post('/api/config/import', (req, res) => {
    try {
      const { content, format } = req.body;
      const scope = req.query.scope || 'local';
      let configPath = scope === 'global' ? getGlobalConfigPath() : getLocalConfigPath();

      let parsed;
      if (format === 'json') {
        parsed = JSON.parse(content);
      } else {
        parsed = yaml.load(content);
      }

      // 合并配置
      if (!fs.existsSync(configPath)) {
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
      }

      const existingConfig = fs.existsSync(configPath) ? loadConfig(configPath) : { settings: { alias: 'zcc' }, base: {}, profiles: {} };

      if (parsed.profiles) {
        existingConfig.profiles = { ...existingConfig.profiles, ...parsed.profiles };
      }
      if (parsed.base) {
        existingConfig.base = { ...existingConfig.base, ...parsed.base };
      }
      if (parsed.settings) {
        existingConfig.settings = { ...existingConfig.settings, ...parsed.settings };
      }

      saveConfig(existingConfig, configPath);

      res.json({
        success: true,
        message: 'Config imported successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 导出配置
  app.get('/api/config/export', (req, res) => {
    try {
      const scope = req.query.scope || 'local';
      const format = req.query.format || 'yaml';
      let configPath;

      if (scope === 'global') {
        configPath = getGlobalConfigPath();
      } else {
        configPath = getLocalConfigPath();
      }

      if (!fs.existsSync(configPath)) {
        return res.status(404).json({
          success: false,
          error: 'Config file not found',
        });
      }

      const config = loadConfig(configPath);
      let content;

      if (format === 'json') {
        content = JSON.stringify(config, null, 2);
      } else {
        content = yaml.dump(config, { indent: 2 });
      }

      res.json({
        success: true,
        data: content,
        filename: `models.${format === 'json' ? 'json' : 'yaml'}`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 启动 Claude Code
  app.post('/api/launch/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { launchCommand } = require('./launch');

      // 在新进程中启动
      const ccPath = path.join(__dirname, '..', '..', 'bin', 'cc.js');
      const child = spawn('node', [ccPath, id], {
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      res.json({
        success: true,
        message: `Launching Claude Code with profile '${id}'`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 应用配置到 settings
  app.post('/api/use/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { useCommand } = require('./use');

      const usePath = path.join(__dirname, '..', '..', 'bin', 'cc.js');
      const child = spawn('node', [usePath, 'use', id], {
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      res.json({
        success: true,
        message: `Applied profile '${id}' to settings`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 启动代理
  app.post('/api/serve/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { serveCommand } = require('./serve');

      const servePath = path.join(__dirname, '..', '..', 'bin', 'cc.js');
      const child = spawn('node', [servePath, 'serve', id], {
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      res.json({
        success: true,
        message: `Starting proxy for profile '${id}'`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // 停止代理
  app.delete('/api/serve/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { serveCommand } = require('./serve');

      const servePath = path.join(__dirname, '..', '..', 'bin', 'cc.js');
      const child = spawn('node', [servePath, 'serve', 'stop', id], {
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      res.json({
        success: true,
        message: `Stopping proxy for profile '${id}'`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // SPA fallback - all unknown routes return index.html
  app.get('/{*path}', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'web', 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.json({
        message: 'zcc web server is running. Frontend not built yet.',
        setup: 'Run frontend build to create React UI',
      });
    }
  });

  return app;
}

/**
 * web 命令入口
 */
async function webCommand(options = {}) {
  const app = createServer();

  // 使用指定端口或查找空闲端口
  const port = options.port ? parseInt(options.port, 10) : await findAvailablePort(3000);

  const server = app.listen(port, 'localhost', () => {
    const url = `http://localhost:${port}`;
    console.log(`zcc web 已启动：${url}`);
    console.log(`按 Ctrl+C 停止服务`);
    openBrowser(url);
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n正在关闭服务...');
    server.close(() => {
      console.log('服务已关闭');
      process.exit(0);
    });
  });
}

module.exports = { webCommand, createServer };
