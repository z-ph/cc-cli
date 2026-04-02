const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.claude');
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'models.yaml');
const LOCAL_CONFIG_DIR = '.claude';
const LOCAL_CONFIG_PATH = path.join(LOCAL_CONFIG_DIR, 'models.yaml');

const DEFAULT_CONFIG = {
  settings: {
    alias: 'cc'
  },
  envs: {},
  configs: {}
};

function getLocalConfigPath() {
  return path.resolve(process.cwd(), LOCAL_CONFIG_PATH);
}

function getGlobalConfigPath() {
  return GLOBAL_CONFIG_PATH;
}

function findEnvConfig(configId, customConfigPath) {
  // Priority 1: Custom config file (if specified)
  if (customConfigPath) {
    const resolvedPath = path.resolve(customConfigPath);
    if (fs.existsSync(resolvedPath)) {
      const config = yaml.load(fs.readFileSync(resolvedPath, 'utf8'));
      return { config, configPath: resolvedPath, source: 'custom' };
    }
    return { config: null, configPath: resolvedPath, source: 'custom' };
  }

  // Priority 2: Local config (.claude/models.yaml in current directory)
  const localPath = getLocalConfigPath();
  if (fs.existsSync(localPath)) {
    const config = yaml.load(fs.readFileSync(localPath, 'utf8'));
    if (config.envs && config.envs[configId]) {
      return { config, configPath: localPath, source: 'local' };
    }
  }

  // Priority 3: Global config (~/.claude/models.yaml)
  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    const config = yaml.load(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
    if (config.envs && config.envs[configId]) {
      return { config, configPath: GLOBAL_CONFIG_PATH, source: 'global' };
    }
  }

  return { config: null, configPath: localPath, source: null };
}

function findConfigEntry(configId, customConfigPath) {
  // Priority 1: Custom config file (if specified)
  if (customConfigPath) {
    const resolvedPath = path.resolve(customConfigPath);
    if (fs.existsSync(resolvedPath)) {
      const config = yaml.load(fs.readFileSync(resolvedPath, 'utf8'));
      return { config, configPath: resolvedPath, source: 'custom' };
    }
    return { config: null, configPath: resolvedPath, source: 'custom' };
  }

  // Priority 2: Local config (.claude/models.yaml in current directory)
  const localPath = getLocalConfigPath();
  if (fs.existsSync(localPath)) {
    const config = yaml.load(fs.readFileSync(localPath, 'utf8'));
    if (config.configs && config.configs[configId]) {
      return { config, configPath: localPath, source: 'local' };
    }
  }

  // Priority 3: Global config (~/.claude/models.yaml)
  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    const config = yaml.load(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
    if (config.configs && config.configs[configId]) {
      return { config, configPath: GLOBAL_CONFIG_PATH, source: 'global' };
    }
  }

  return { config: null, configPath: localPath, source: null };
}

function loadConfig(customConfigPath) {
  const targetPath = customConfigPath
    ? path.resolve(customConfigPath)
    : GLOBAL_CONFIG_PATH;

  if (!fs.existsSync(targetPath)) {
    // Ensure global config exists for saving
    if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
      fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }
    saveConfig(DEFAULT_CONFIG, targetPath);
    return { ...DEFAULT_CONFIG };
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  return yaml.load(content);
}

function saveConfig(config, customConfigPath) {
  const targetPath = customConfigPath || GLOBAL_CONFIG_PATH;
  const targetDir = path.dirname(targetPath);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const yamlContent = yaml.dump(config, { indent: 2 });
  fs.writeFileSync(targetPath, yamlContent, 'utf8');
}

module.exports = {
  loadConfig,
  saveConfig,
  findEnvConfig,
  findConfigEntry,
  getLocalConfigPath,
  getGlobalConfigPath
};
