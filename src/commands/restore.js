const fs = require('fs');
const path = require('path');
const os = require('os');

function restoreCommand(options = {}) {
  const useGlobal = options?.global;

  let settingsPath;
  let sourcePath;

  if (useGlobal) {
    settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    sourcePath = path.join(os.homedir(), '.claude', 'settings.source.json');
  } else {
    settingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
    sourcePath = path.join(process.cwd(), '.claude', 'settings.source.json');
  }

  if (!fs.existsSync(sourcePath)) {
    console.error('Error: No backup found. Run "cc use <config-id>" first to create a backup.');
    process.exit(1);
  }

  fs.copyFileSync(sourcePath, settingsPath);
  console.log(`Restored from: ${sourcePath}`);
  console.log(`Applied to:    ${settingsPath}`);
}

module.exports = { restoreCommand };
