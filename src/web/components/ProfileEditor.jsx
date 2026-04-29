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
  // Anthropic core config
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_ORG_ID',
  'ANTHROPIC_PROJECT_ID',

  // Claude Code behavior
  'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
  'CLAUDE_CODE_SUBAGENT_MODEL',
  'CLAUDE_CODE_SHELL',
  'CLAUDE_CODE_WORKING_DIR',
  'CLAUDE_CODE_USE_TMUX',
  'CLAUDE_CODE_SKIP_PROMPT_PERSONALIZATION',
  'CLAUDE_CODE_DISABLE_THINKING_TOOL',
  'CLAUDE_CODE_SYSTEM_PROMPT',
  'CLAUDE_CODE_LLM_FIM_MODEL',
  'CLAUDE_CODE_LLM_FIM_ENDPOINT',
  'CLAUDE_CODE_LLM_FIM_API_KEY',
  'CLAUDE_CODE_LLM_FIM_MAX_TOKENS',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',

  // Network / proxy
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',

  // Debug / advanced / misc
  'CLAUDE_CODE_DEBUG',
  'DISABLE_PROMPT_CACHING',
  'DISABLE_COST_WARNINGS',
  'DISABLE_ERROR_REPORTING',
  'API_TIMEOUT_MS',
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
