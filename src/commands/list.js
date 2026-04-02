const { loadConfig } = require('../config/loader');

function listCommand() {
  const config = loadConfig();

  console.log('Available configurations:\n');

  const modelIds = Object.keys(config.models);

  if (modelIds.length === 0) {
    console.log('  No configurations found.');
    console.log('  Run "cc add <config-id>" to create one.');
    return;
  }

  for (const id of modelIds) {
    const model = config.models[id];
    console.log(`  ${id}`);
    console.log(`    baseurl: ${model.baseurl}`);
    console.log(`    model:   ${model.model}`);
    const envKeys = Object.keys(model.env || {});
    if (envKeys.length > 0) {
      console.log(`    env:     ${envKeys.join(', ')}`);
    }
    console.log();
  }

  console.log(`Total: ${modelIds.length} configuration(s)`);
}

module.exports = { listCommand };
