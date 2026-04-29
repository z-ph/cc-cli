import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useLanguage } from './LanguageContext';
import { getTranslation } from '../i18n';

const uid = () => Math.random().toString(36).slice(2, 10);

const ENV_KEY_SUGGESTIONS = [
  // Anthropic core
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_ORG_ID',
  'ANTHROPIC_PROJECT_ID',

  // Provider
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'ANTHROPIC_FOUNDRY_API_KEY',
  'ANTHROPIC_FOUNDRY_BASE_URL',
  'ANTHROPIC_FOUNDRY_RESOURCE',
  'ANTHROPIC_BEARER_TOKEN_BEDROCK',
  'AWS_BEARER_TOKEN_BEDROCK',
  'ANTHROPIC_CUSTOM_HEADERS',
  'ANTHROPIC_BETAS',
  'CLAUDE_CODE_SKIP_BEDROCK_AUTH',
  'CLAUDE_CODE_SKIP_VERTEX_AUTH',
  'CLAUDE_CODE_SKIP_FOUNDRY_AUTH',
  'CLAUDE_CODE_CLIENT_CERT',
  'CLAUDE_CODE_CLIENT_KEY',
  'CLAUDE_CODE_CLIENT_KEY_PASSPHRASE',
  'CLAUDE_CONFIG_DIR',

  // Auth
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_REFRESH_TOKEN',
  'CLAUDE_CODE_OAUTH_SCOPES',

  // Model
  'CLAUDE_CODE_EFFORT_LEVEL',
  'MAX_THINKING_TOKENS',
  'CLAUDE_CODE_DISABLE_THINKING',
  'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING',
  'CLAUDE_CODE_SUBAGENT_MODEL',
  'ANTHROPIC_CUSTOM_MODEL_OPTION',
  'ANTHROPIC_CUSTOM_MODEL_OPTION_NAME',
  'ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_SMALL_FAST_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION',
  'CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP',
  'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
  'CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS',
  'DISABLE_INTERLEAVED_THINKING',
  'DISABLE_PROMPT_CACHING',
  'DISABLE_PROMPT_CACHING_HAIKU',
  'DISABLE_PROMPT_CACHING_OPUS',
  'DISABLE_PROMPT_CACHING_SONNET',
  'ENABLE_PROMPT_CACHING_1H_BEDROCK',
  'MAX_STRUCTURED_OUTPUT_RETRIES',
  'FALLBACK_FOR_ALL_PRIMARY_MODELS',

  // Network
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'API_TIMEOUT_MS',
  'CLAUDE_CODE_MAX_RETRIES',
  'CLAUDE_CODE_PROXY_RESOLVES_HOSTS',
  'CLAUDE_ENABLE_STREAM_WATCHDOG',
  'CLAUDE_STREAM_IDLE_TIMEOUT_MS',

  // MCP
  'MCP_TIMEOUT',
  'MCP_TOOL_TIMEOUT',
  'MAX_MCP_OUTPUT_TOKENS',
  'ENABLE_CLAUDEAI_MCP_SERVERS',
  'ENABLE_TOOL_SEARCH',
  'MCP_CLIENT_SECRET',
  'MCP_CONNECTION_NONBLOCKING',
  'MCP_OAUTH_CALLBACK_PORT',
  'MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE',
  'MCP_SERVER_CONNECTION_BATCH_SIZE',

  // Privacy
  'DISABLE_TELEMETRY',
  'DISABLE_ERROR_REPORTING',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'DISABLE_COST_WARNINGS',
  'CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY',
  'IS_DEMO',

  // Context
  'DISABLE_AUTO_COMPACT',
  'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE',
  'CLAUDE_CODE_DISABLE_1M_CONTEXT',
  'DISABLE_COMPACT',
  'CLAUDE_CODE_AUTO_COMPACT_WINDOW',

  // Shell
  'BASH_DEFAULT_TIMEOUT_MS',
  'BASH_MAX_TIMEOUT_MS',
  'CLAUDE_CODE_SHELL',
  'CLAUDE_CODE_SHELL_PREFIX',
  'BASH_MAX_OUTPUT_LENGTH',
  'CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR',
  'TASK_MAX_OUTPUT_LENGTH',

  // Feature
  'CLAUDE_CODE_DISABLE_FAST_MODE',
  'CLAUDE_CODE_DISABLE_AUTO_MEMORY',
  'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS',
  'CLAUDE_CODE_DISABLE_CRON',
  'CLAUDE_CODE_DISABLE_ATTACHMENTS',
  'CLAUDE_CODE_DISABLE_CLAUDE_MDS',
  'CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING',
  'CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS',
  'CLAUDE_CODE_DISABLE_MOUSE',
  'CLAUDE_CODE_DISABLE_TERMINAL_TITLE',
  'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
  'CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK',
  'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
  'CLAUDE_AUTO_BACKGROUND_TASKS',
  'CLAUDE_CODE_ENABLE_TASKS',
  'CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION',
  'CLAUDE_CODE_ENABLE_TELEMETRY',
  'CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING',
  'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB',
  'CLAUDE_CODE_EXIT_AFTER_STOP_DELAY',
  'CLAUDE_CODE_RESUME_INTERRUPTED_TURN',
  'CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS',
  'CLAUDE_CODE_USE_POWERSHELL_TOOL',
  'DISABLE_AUTOUPDATER',
  'DISABLE_DOCTOR_COMMAND',
  'DISABLE_EXTRA_USAGE_COMMAND',
  'DISABLE_FEEDBACK_COMMAND',
  'DISABLE_INSTALLATION_CHECKS',
  'DISABLE_INSTALL_GITHUB_APP_COMMAND',
  'DISABLE_LOGIN_COMMAND',
  'DISABLE_LOGOUT_COMMAND',
  'DISABLE_UPGRADE_COMMAND',
  'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD',
  'CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS',
  'CLAUDE_CODE_TASK_LIST_ID',
  'CLAUDE_CODE_TEAM_NAME',
  'CLAUDE_ENV_FILE',
  'USE_BUILTIN_RIPGREP',

  // Plugin
  'CLAUDE_CODE_PLUGIN_CACHE_DIR',
  'CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS',
  'CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE',
  'CLAUDE_CODE_PLUGIN_SEED_DIR',
  'CLAUDE_CODE_SYNC_PLUGIN_INSTALL',
  'CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS',
  'CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL',
  'FORCE_AUTOUPDATE_PLUGINS',

  // OTelemetry
  'OTEL_LOG_TOOL_CONTENT',
  'OTEL_LOG_TOOL_DETAILS',
  'OTEL_LOG_USER_PROMPTS',
  'OTEL_METRICS_INCLUDE_ACCOUNT_UUID',
  'OTEL_METRICS_INCLUDE_SESSION_ID',
  'OTEL_METRICS_INCLUDE_VERSION',
  'CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS',
  'CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS',
  'CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS',

  // Vertex
  'VERTEX_REGION_CLAUDE_3_5_HAIKU',
  'VERTEX_REGION_CLAUDE_3_5_SONNET',
  'VERTEX_REGION_CLAUDE_3_7_SONNET',
  'VERTEX_REGION_CLAUDE_4_0_OPUS',
  'VERTEX_REGION_CLAUDE_4_0_SONNET',
  'VERTEX_REGION_CLAUDE_4_1_OPUS',
  'VERTEX_REGION_CLAUDE_4_5_SONNET',
  'VERTEX_REGION_CLAUDE_4_6_SONNET',
  'VERTEX_REGION_CLAUDE_HAIKU_4_5',

  // Display
  'CLAUDE_CODE_ACCESSIBILITY',
  'CLAUDE_CODE_SYNTAX_HIGHLIGHT',
  'CLAUDE_CODE_NO_FLICKER',
  'CLAUDE_CODE_SCROLL_SPEED',
  'CLAUDE_CODE_GLOB_HIDDEN',
  'CLAUDE_CODE_GLOB_NO_IGNORE',
  'CLAUDE_CODE_GLOB_TIMEOUT_SECONDS',
  'CLAUDE_CODE_SIMPLE',
  'CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY',
  'CLAUDE_CODE_NEW_INIT',
  'CLAUDE_CODE_IDE_HOST_OVERRIDE',
  'CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL',
  'CLAUDE_CODE_IDE_SKIP_VALID_CHECK',
  'CLAUDE_CODE_AUTO_CONNECT_IDE',
  'CLAUDE_CODE_TMPDIR',
  'CLAUDE_CODE_DEBUG_LOGS_DIR',
  'CLAUDE_CODE_DEBUG_LOG_LEVEL',
  'CLAUDE_CODE_GIT_BASH_PATH',
  'SLASH_COMMAND_TOOL_CHAR_BUDGET',
  'CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS',
  'CLAUDE_AGENT_SDK_MCP_NO_PREFIX',
  'CLAUDE_CODE_API_KEY_HELPER_TTL_MS',

  // Debug / advanced / misc (legacy web-only)
  'CLAUDE_CODE_DEBUG',
  'CLAUDE_CODE_WORKING_DIR',
  'CLAUDE_CODE_USE_TMUX',
  'CLAUDE_CODE_SKIP_PROMPT_PERSONALIZATION',
  'CLAUDE_CODE_DISABLE_THINKING_TOOL',
  'CLAUDE_CODE_SYSTEM_PROMPT',
  'CLAUDE_CODE_LLM_FIM_MODEL',
  'CLAUDE_CODE_LLM_FIM_ENDPOINT',
  'CLAUDE_CODE_LLM_FIM_API_KEY',
  'CLAUDE_CODE_LLM_FIM_MAX_TOKENS',
];

const PERMISSION_SUGGESTIONS = [
  'Bash(*)',
  'Bash(npm *)',
  'Bash(pnpm *)',
  'Bash(git *)',
  'Bash(node *)',
  'Bash(npx *)',
  'Read',
  'Write',
  'Edit',
  'WebFetch',
  'WebSearch',
  'mcp__*',
];

const MODEL_SUGGESTIONS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5',
];

function ProfileEditor({ open, onClose, profile, onSave }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(key, language);
  const [id, setId] = useState('');
  const [isExisting, setIsExisting] = useState(false);
  const [envEntries, setEnvEntries] = useState([]);
  const [permissions, setPermissions] = useState({ allow: [], deny: [] });
  const [modelEntries, setModelEntries] = useState([]);
  const [hooks, setHooks] = useState({});

  useEffect(() => {
    if (profile) {
      setId(profile.id || '');
      setIsExisting(true);
      setEnvEntries(
        Object.entries(profile.env || {}).map(([key, value]) => ({
          id: uid(), key, value,
        }))
      );
      setPermissions(profile.permissions || { allow: [], deny: [] });
      setModelEntries(
        Object.entries(profile.modelOverride || {}).map(([source, target]) => ({
          id: uid(), source, target,
        }))
      );
      setHooks(profile.hooks || {});
    } else {
      setId('');
      setIsExisting(false);
      setEnvEntries([]);
      setPermissions({ allow: [], deny: [] });
      setModelEntries([]);
      setHooks({});
    }
  }, [profile, open]);

  const handleSave = () => {
    const profileData = {};
    const env = Object.fromEntries(
      envEntries.filter((e) => e.key).map((e) => [e.key, e.value])
    );
    if (Object.keys(env).length > 0) {
      profileData.env = env;
    }
    if (permissions.allow?.length > 0 || permissions.deny?.length > 0) {
      profileData.permissions = permissions;
    }
    const modelOverride = Object.fromEntries(
      modelEntries.filter((e) => e.source).map((e) => [e.source, e.target])
    );
    if (Object.keys(modelOverride).length > 0) {
      profileData.modelOverride = modelOverride;
    }
    if (Object.keys(hooks).length > 0) {
      profileData.hooks = hooks;
    }
    onSave(id, profileData, isExisting);
  };

  const handleAddEnv = () => {
    setEnvEntries([...envEntries, { id: uid(), key: '', value: '' }]);
  };

  const handleDeleteEnv = (id) => {
    setEnvEntries(envEntries.filter((e) => e.id !== id));
  };

  const handleAddPermission = (type) => {
    setPermissions((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), ''],
    }));
  };

  const handlePermissionChange = (type, index, value) => {
    setPermissions((prev) => {
      const list = [...(prev[type] || [])];
      list[index] = value;
      return { ...prev, [type]: list };
    });
  };

  const handleDeletePermission = (type, index) => {
    setPermissions((prev) => ({
      ...prev,
      [type]: (prev[type] || []).filter((_, i) => i !== index),
    }));
  };

  const handleAddModel = () => {
    setModelEntries([...modelEntries, { id: uid(), source: '', target: '' }]);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isExisting ? `${t('editProfile')}: ${id}` : t('addProfileTitle')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {/* Profile ID */}
          {!isExisting && (
            <TextField
              fullWidth
              label={t('profileId')}
              value={id}
              onChange={(e) => setId(e.target.value)}
              sx={{ mb: 3 }}
              required
            />
          )}

          {/* Environment Variables */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">{t('environmentVariables')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 1 }}>
                <Button size="small" startIcon={<AddIcon />} onClick={handleAddEnv}>
                  {t('addVariable')}
                </Button>
              </Box>
              {envEntries.map((entry) => (
                <Box key={entry.id} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={ENV_KEY_SUGGESTIONS}
                    value={entry.key}
                    onInputChange={(e, newValue) => {
                      setEnvEntries(envEntries.map((en) =>
                        en.id === entry.id ? { ...en, key: newValue } : en
                      ));
                    }}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Key" />
                    )}
                    sx={{ width: 260 }}
                    selectOnFocus
                    clearOnBlur={false}
                    handleHomeEndKeys
                  />
                  <TextField
                    size="small"
                    placeholder="Value"
                    value={entry.value}
                    onChange={(e) => {
                      setEnvEntries(envEntries.map((en) =>
                        en.id === entry.id ? { ...en, value: e.target.value } : en
                      ));
                    }}
                    sx={{ flexGrow: 1 }}
                  />
                  <IconButton size="small" onClick={() => handleDeleteEnv(entry.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>

          {/* Permissions */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">{t('permissionsConfig')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle2" gutterBottom>
                {t('allow')}
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddPermission('allow')}
                >
                  {t('addAllowRule')}
                </Button>
              </Box>
              {permissions.allow?.map((rule, index) => (
                <Box
                  key={`allow-${index}`}
                  sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
                >
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={PERMISSION_SUGGESTIONS}
                    value={rule}
                    onInputChange={(e, newValue) => {
                      handlePermissionChange('allow', index, newValue);
                    }}
                    renderInput={(params) => (
                      <TextField {...params} placeholder={t('allowExample')} />
                    )}
                    sx={{ flexGrow: 1 }}
                    selectOnFocus
                    clearOnBlur={false}
                    handleHomeEndKeys
                  />
                  <IconButton size="small" onClick={() => handleDeletePermission('allow', index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                {t('deny')}
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddPermission('deny')}
                >
                  {t('addDenyRule')}
                </Button>
              </Box>
              {permissions.deny?.map((rule, index) => (
                <Box
                  key={`deny-${index}`}
                  sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
                >
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={PERMISSION_SUGGESTIONS}
                    value={rule}
                    onInputChange={(e, newValue) => {
                      handlePermissionChange('deny', index, newValue);
                    }}
                    renderInput={(params) => (
                      <TextField {...params} placeholder={t('denyExample')} />
                    )}
                    sx={{ flexGrow: 1 }}
                    selectOnFocus
                    clearOnBlur={false}
                    handleHomeEndKeys
                  />
                  <IconButton size="small" onClick={() => handleDeletePermission('deny', index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>

          {/* Model Override */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">{t('modelOverride')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('modelOverrideHint')}
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Button size="small" startIcon={<AddIcon />} onClick={handleAddModel}>
                  {t('addMapping')}
                </Button>
              </Box>
              {modelEntries.map((entry) => (
                <Box key={entry.id} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={MODEL_SUGGESTIONS}
                    value={entry.source}
                    onInputChange={(e, newValue) => {
                      setModelEntries(modelEntries.map((en) =>
                        en.id === entry.id ? { ...en, source: newValue } : en
                      ));
                    }}
                    renderInput={(params) => (
                      <TextField {...params} placeholder={t('sourceModel')} />
                    )}
                    sx={{ flexGrow: 1 }}
                    selectOnFocus
                    clearOnBlur={false}
                    handleHomeEndKeys
                  />
                  <Typography variant="body2" color="text.secondary">
                    →
                  </Typography>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={MODEL_SUGGESTIONS}
                    value={entry.target}
                    onInputChange={(e, newValue) => {
                      setModelEntries(modelEntries.map((en) =>
                        en.id === entry.id ? { ...en, target: newValue } : en
                      ));
                    }}
                    renderInput={(params) => (
                      <TextField {...params} placeholder={t('targetModel')} />
                    )}
                    sx={{ flexGrow: 1 }}
                    selectOnFocus
                    clearOnBlur={false}
                    handleHomeEndKeys
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setModelEntries(modelEntries.filter((en) => en.id !== entry.id));
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={handleSave} variant="contained" disabled={!id}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProfileEditor;
