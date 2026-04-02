const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const CONFIG_DIR = path.join(os.homedir(), '.claude');
const CONFIG_PATH = path.join(CONFIG_DIR, 'models.yaml');

const DEFAULT_CONFIG = {
  settings: {
    alias: 'cc'
  },
  models: {}
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  return yaml.load(content);
}

function saveConfig(config) {
  ensureConfigDir();
  const yamlContent = yaml.dump(config, { indent: 2 });
  fs.writeFileSync(CONFIG_PATH, yamlContent, 'utf8');
}

module.exports = { loadConfig, saveConfig };
