import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

function ProfileEditor({ open, onClose, profile, onSave }) {
  const [id, setId] = useState('');
  const [isExisting, setIsExisting] = useState(false);
  const [env, setEnv] = useState({});
  const [permissions, setPermissions] = useState({ allow: [], deny: [] });
  const [modelOverride, setModelOverride] = useState({});
  const [hooks, setHooks] = useState({});

  useEffect(() => {
    if (profile) {
      setId(profile.id || '');
      setIsExisting(true);
      setEnv(profile.env || {});
      setPermissions(profile.permissions || { allow: [], deny: [] });
      setModelOverride(profile.modelOverride || {});
      setHooks(profile.hooks || {});
    } else {
      setId('');
      setIsExisting(false);
      setEnv({});
      setPermissions({ allow: [], deny: [] });
      setModelOverride({});
      setHooks({});
    }
  }, [profile, open]);

  const handleSave = () => {
    const profileData = {};

    if (Object.keys(env).length > 0) {
      profileData.env = env;
    }

    if (permissions.allow?.length > 0 || permissions.deny?.length > 0) {
      profileData.permissions = permissions;
    }

    if (Object.keys(modelOverride).length > 0) {
      profileData.modelOverride = modelOverride;
    }

    if (Object.keys(hooks).length > 0) {
      profileData.hooks = hooks;
    }

    onSave(id, profileData, isExisting);
  };

  const handleAddEnv = () => {
    setEnv({ ...env, 'NEW_KEY': '' });
  };

  const handleEnvChange = (key, value) => {
    const newEnv = { ...env };
    if (key === 'NEW_KEY') {
      delete newEnv['NEW_KEY'];
    }
    newEnv[key] = value;
    setEnv(newEnv);
  };

  const handleDeleteEnv = (key) => {
    const newEnv = { ...env };
    delete newEnv[key];
    setEnv(newEnv);
  };

  const handleAddPermission = (type) => {
    const newPermissions = { ...permissions };
    if (!newPermissions[type]) {
      newPermissions[type] = [];
    }
    newPermissions[type] = [...newPermissions[type], ''];
    setPermissions(newPermissions);
  };

  const handlePermissionChange = (type, index, value) => {
    const newPermissions = { ...permissions };
    newPermissions[type][index] = value;
    setPermissions(newPermissions);
  };

  const handleDeletePermission = (type, index) => {
    const newPermissions = { ...permissions };
    newPermissions[type] = newPermissions[type].filter((_, i) => i !== index);
    setPermissions(newPermissions);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isExisting ? `编辑 Profile: ${id}` : '添加 Profile'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {/* Profile ID */}
          {!isExisting && (
            <TextField
              fullWidth
              label="Profile ID"
              value={id}
              onChange={(e) => setId(e.target.value)}
              sx={{ mb: 3 }}
              required
            />
          )}

          {/* Environment Variables */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">环境变量</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddEnv}
                >
                  添加变量
                </Button>
              </Box>
              {Object.entries(env).map(([key, value]) => (
                <Box
                  key={key}
                  sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
                >
                  <TextField
                    size="small"
                    placeholder="Key"
                    value={key === 'NEW_KEY' ? '' : key}
                    onChange={(e) =>
                      key === 'NEW_KEY'
                        ? handleEnvChange('NEW_KEY', value) &&
                          handleEnvChange(e.target.value, value)
                        : handleEnvChange(key, value)
                    }
                    sx={{ width: 200 }}
                  />
                  <TextField
                    size="small"
                    placeholder="Value"
                    value={value}
                    onChange={(e) => handleEnvChange(key, e.target.value)}
                    sx={{ flexGrow: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteEnv(key)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>

          {/* Permissions */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">权限配置</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle2" gutterBottom>
                Allow
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddPermission('allow')}
                >
                  添加允许规则
                </Button>
              </Box>
              {permissions.allow?.map((rule, index) => (
                <Box
                  key={`allow-${index}`}
                  sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
                >
                  <TextField
                    size="small"
                    placeholder="例如：Bash(npm run *)"
                    value={rule}
                    onChange={(e) =>
                      handlePermissionChange('allow', index, e.target.value)
                    }
                    sx={{ flexGrow: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleDeletePermission('allow', index)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Deny
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddPermission('deny')}
                >
                  添加拒绝规则
                </Button>
              </Box>
              {permissions.deny?.map((rule, index) => (
                <Box
                  key={`deny-${index}`}
                  sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
                >
                  <TextField
                    size="small"
                    placeholder="例如：Bash(rm -rf *)"
                    value={rule}
                    onChange={(e) =>
                      handlePermissionChange('deny', index, e.target.value)
                    }
                    sx={{ flexGrow: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleDeletePermission('deny', index)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>

          {/* Model Override */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">模型映射 (Model Override)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                配置模型名称映射，例如：claude-sonnet-4-20250514 → claude-opus-4-20250514
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setModelOverride({ ...modelOverride, '': '' })}
                >
                  添加映射
                </Button>
              </Box>
              {Object.entries(modelOverride).map(([source, target]) => (
                <Box
                  key={source}
                  sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
                >
                  <TextField
                    size="small"
                    placeholder="源模型名称"
                    value={source}
                    onChange={(e) => {
                      const newOverride = { ...modelOverride };
                      delete newOverride[source];
                      newOverride[e.target.value] = target;
                      setModelOverride(newOverride);
                    }}
                    sx={{ flexGrow: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">→</Typography>
                  <TextField
                    size="small"
                    placeholder="目标模型名称"
                    value={target}
                    onChange={(e) => {
                      setModelOverride({ ...modelOverride, [source]: e.target.value });
                    }}
                    sx={{ flexGrow: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      const newOverride = { ...modelOverride };
                      delete newOverride[source];
                      setModelOverride(newOverride);
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
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained" disabled={!id}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProfileEditor;
