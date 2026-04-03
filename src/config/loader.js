const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const { deepMerge } = require('./merger');

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.claude');
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'models.yaml');
const LOCAL_CONFIG_DIR = '.claude';
const LOCAL_CONFIG_PATH = path.join(LOCAL_CONFIG_DIR, 'models.yaml');

const DEFAULT_CONFIG = {
  settings: {
    alias: 'cc'
  },
  base: {},
  profiles: {}
};

function getLocalConfigPath() {
  return path.resolve(process.cwd(), LOCAL_CONFIG_PATH);
}

function getGlobalConfigPath() {
  return GLOBAL_CONFIG_PATH;
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

/**
 * Load global config if it exists, return null otherwise.
 */
function loadGlobalConfig() {
  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    return yaml.load(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
  }
  return null;
}

/**
 * Resolve a profile with cascading base inheritance.
 * Chain: globalBase → localBase → profile (each layer wins over the previous).
 */
function resolveProfile(globalConfig, localConfig, profileId) {
  const globalBase = globalConfig?.base || {};
  const localBase = localConfig?.base || {};
  const profile = localConfig?.profiles?.[profileId] || globalConfig?.profiles?.[profileId];
  return deepMerge(deepMerge(globalBase, localBase), profile);
}

/**
 * Find a profile by ID across local, global, and custom config files.
 *
 * Base inheritance chain: globalBase → localBase → profile
 * When a profile is found locally, the global base is still loaded and merged first.
 * When a profile is found globally, only the global base applies.
 *
 * Returns { profile, configPath, source } where profile is the fully resolved result.
 * Returns { profile: null, ... } if not found.
 */
function findProfile(profileId, customConfigPath) {
  // Always preload global config for base inheritance
  const globalConfig = loadGlobalConfig();

  // Priority 1: Custom config file (if specified)
  if (customConfigPath) {
    const resolvedPath = path.resolve(customConfigPath);
    if (fs.existsSync(resolvedPath)) {
      const config = yaml.load(fs.readFileSync(resolvedPath, 'utf8'));
      if (config.profiles && config.profiles[profileId]) {
        return {
          profile: resolveProfile(globalConfig, config, profileId),
          configPath: resolvedPath,
          source: 'custom'
        };
      }
    }
    return { profile: null, configPath: path.resolve(customConfigPath), source: 'custom' };
  }

  // Priority 2: Local config (.claude/models.yaml in current directory)
  const localPath = getLocalConfigPath();
  if (fs.existsSync(localPath)) {
    const localConfig = yaml.load(fs.readFileSync(localPath, 'utf8'));
    if (localConfig.profiles && localConfig.profiles[profileId]) {
      return {
        profile: resolveProfile(globalConfig, localConfig, profileId),
        configPath: localPath,
        source: 'local'
      };
    }
  }

  // Priority 3: Global config (~/.claude/models.yaml)
  if (globalConfig && globalConfig.profiles && globalConfig.profiles[profileId]) {
    return {
      profile: resolveProfile(null, globalConfig, profileId),
      configPath: GLOBAL_CONFIG_PATH,
      source: 'global'
    };
  }

  return { profile: null, configPath: localPath, source: null };
}

/**
 * Given the configPath where models.yaml was found, return the directory
 * where settings.<id>.json files should be written.
 * - local  .claude/models.yaml  → .claude/
 * - global ~/.claude/models.yaml → ~/.claude/
 * - custom /path/to/models.yaml → /path/to/
 */
function getSettingsDir(configPath) {
  return path.dirname(configPath);
}

module.exports = {
  loadConfig,
  saveConfig,
  findProfile,
  getSettingsDir,
  getLocalConfigPath,
  getGlobalConfigPath
};
