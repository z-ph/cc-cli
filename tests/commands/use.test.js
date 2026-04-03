// Set up mocks before importing modules
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/user')
}));
jest.mock('../../src/config/loader');
jest.mock('../../src/config/merger');
jest.mock('fs');

const { useCommand } = require('../../src/commands/use');
const { findProfile } = require('../../src/config/loader');
const { deepMerge } = require('../../src/config/merger');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Use Command', () => {
  let mockExit;
  let mockError;
  let mockLog;

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue('/home/user');
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockError.mockRestore();
    mockLog.mockRestore();
  });

  it('should exit when profile not found', () => {
    findProfile.mockReturnValue({ profile: null, configPath: '/path/to/models.yaml', source: 'global' });

    expect(() => useCommand('nonexistent')).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("Error: Profile 'nonexistent' not found.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should write profile to local .claude/settings.local.json', () => {
    const profile = { permissions: { allow: ['Read'] } };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    fs.existsSync.mockReturnValue(false);
    deepMerge.mockReturnValue(profile);

    mockExit.mockImplementation(() => {});

    useCommand('strict');

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('settings.local.json'),
      JSON.stringify(profile, null, 2),
      'utf8'
    );
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('strict'));
  });

  it('should merge with settings.source.json when it exists', () => {
    const profile = { permissions: { allow: ['Read'] } };
    const sourceContent = { env: { FOO: 'bar' } };
    const finalMerged = { env: { FOO: 'bar' }, permissions: { allow: ['Read'] } };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    fs.existsSync
      .mockReturnValueOnce(true)   // localDir exists
      .mockReturnValueOnce(true)   // settings.local.json exists
      .mockReturnValueOnce(true)   // settings.source.json exists (backup check)
      .mockReturnValueOnce(true);  // settings.source.json exists (merge check)
    fs.readFileSync.mockReturnValue(JSON.stringify(sourceContent));
    deepMerge.mockReturnValue(finalMerged);

    mockExit.mockImplementation(() => {});

    useCommand('strict');

    expect(deepMerge).toHaveBeenCalledWith(sourceContent, profile);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('settings.local.json'),
      JSON.stringify(finalMerged, null, 2),
      'utf8'
    );
  });

  it('should pass target path to findProfile via -t flag', () => {
    const profile = { permissions: { allow: ['Read'] } };

    findProfile.mockReturnValue({ profile, configPath: '/custom/models.yaml', source: 'custom' });
    fs.existsSync.mockReturnValue(false);
    deepMerge.mockReturnValue(profile);

    mockExit.mockImplementation(() => {});

    useCommand('strict', { target: '/custom/models.yaml' });

    expect(findProfile).toHaveBeenCalledWith('strict', '/custom/models.yaml');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should show custom path in error message when source is custom', () => {
    findProfile.mockReturnValue({ profile: null, configPath: '/custom/models.yaml', source: 'custom' });

    expect(() => useCommand('nonexistent', { target: '/custom/models.yaml' })).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith("Error: Profile 'nonexistent' not found in '/custom/models.yaml'.");
  });

  it('should write to ~/.claude/settings.json with -g flag', () => {
    const profile = { permissions: { allow: ['Bash(*)'] } };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'global' });
    fs.existsSync.mockReturnValue(false);
    deepMerge.mockReturnValue(profile);

    mockExit.mockImplementation(() => {});

    useCommand('prod', { global: true });

    const expectedPath = path.join('/home/user', '.claude', 'settings.json');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expectedPath,
      expect.any(String),
      'utf8'
    );
  });

  it('should backup existing settings as source.json (one-time)', () => {
    const profile = { permissions: { allow: ['Read'] } };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    fs.existsSync
      .mockReturnValueOnce(true)   // localDir exists
      .mockReturnValueOnce(true)   // settings.local.json exists
      .mockReturnValueOnce(false)  // settings.source.json does NOT exist (backup check)
      .mockReturnValueOnce(false); // settings.source.json does NOT exist (merge check)

    mockExit.mockImplementation(() => {});

    useCommand('strict');

    expect(fs.copyFileSync).toHaveBeenCalledWith(
      expect.stringContaining('settings.local.json'),
      expect.stringContaining('settings.source.json')
    );
  });

  it('should create ~/.claude dir when missing with -g flag', () => {
    const profile = { permissions: { allow: ['Read'] } };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'global' });
    fs.existsSync
      .mockReturnValueOnce(false)  // globalDir does NOT exist
      .mockReturnValueOnce(false)  // settings.json does NOT exist (backup check)
      .mockReturnValueOnce(false); // settings.source.json does NOT exist (merge check)
    deepMerge.mockReturnValue(profile);

    mockExit.mockImplementation(() => {});

    useCommand('dev', { global: true });

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.join('/home/user', '.claude'),
      { recursive: true }
    );
  });

  it('should not overwrite existing source backup', () => {
    const profile = { permissions: { allow: ['Read'] } };

    findProfile.mockReturnValue({ profile, configPath: '/path/to/models.yaml', source: 'local' });
    fs.existsSync
      .mockReturnValueOnce(true)   // localDir exists
      .mockReturnValueOnce(true)   // settings.local.json exists
      .mockReturnValueOnce(true)   // settings.source.json exists (backup check)
      .mockReturnValueOnce(true);  // settings.source.json exists (merge check)

    fs.readFileSync.mockReturnValue(JSON.stringify({}));
    deepMerge.mockReturnValue({ permissions: { allow: ['Read'] } });

    mockExit.mockImplementation(() => {});

    useCommand('strict');

    expect(fs.copyFileSync).not.toHaveBeenCalled();
  });
});
