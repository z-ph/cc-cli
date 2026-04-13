import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Layout from './Layout';
import ProfileList from './ProfileList';
import ProfileEditor from './ProfileEditor';
import BaseEditor from './BaseEditor';
import RawYamlViewer from './RawYamlViewer';
import ConfigImport from './ConfigImport';
import ConfigExport from './ConfigExport';
import { fetchConfig, fetchProfiles } from '../api';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '8px 16px',
        },
      },
    },
  },
});

function App() {
  const [scope, setScope] = useState('local');
  const [profiles, setProfiles] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog states
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [baseEditorOpen, setBaseEditorOpen] = useState(false);
  const [rawYamlOpen, setRawYamlOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const [configRes, profilesRes] = await Promise.all([
        fetchConfig(scope),
        fetchProfiles(scope),
      ]);

      if (configRes.success) {
        setConfig({ ...configRes.data, configPath: configRes.configPath });
      }
      if (profilesRes.success) {
        setProfiles(profilesRes.data);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [scope]);

  const handleAddProfile = () => {
    setEditingProfile(null);
    setProfileEditorOpen(true);
  };

  const handleEditProfile = (profile) => {
    setEditingProfile(profile);
    setProfileEditorOpen(true);
  };

  const handleDeleteProfile = async (id) => {
    if (!window.confirm(`确定要删除 profile '${id}' 吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/profiles/${id}?scope=${scope}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        loadData();
      } else {
        alert(`删除失败：${result.error}`);
      }
    } catch (err) {
      alert(`删除失败：${err.message}`);
    }
  };

  const handleSaveProfile = async (id, profile, isExisting) => {
    try {
      const url = isExisting
        ? `/api/profiles/${id}`
        : `/api/profiles`;
      const method = isExisting ? 'PUT' : 'POST';

      const response = await fetch(`${url}?scope=${scope}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...profile }),
      });
      const result = await response.json();

      if (result.success) {
        setProfileEditorOpen(false);
        loadData();
      } else {
        alert(`保存失败：${result.error}`);
      }
    } catch (err) {
      alert(`保存失败：${err.message}`);
    }
  };

  const handleLaunch = async (id) => {
    try {
      const response = await fetch(`/api/launch/${id}`, {
        method: 'POST',
      });
      const result = await response.json();
      alert(result.message || result.error);
    } catch (err) {
      alert(`启动失败：${err.message}`);
    }
  };

  const handleUse = async (id) => {
    try {
      const response = await fetch(`/api/use/${id}`, {
        method: 'POST',
      });
      const result = await response.json();
      alert(result.message || result.error);
    } catch (err) {
      alert(`应用失败：${err.message}`);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout
        scope={scope}
        onScopeChange={setScope}
        configPath={config?.configPath}
        profileCount={profiles.length}
        onAddProfile={handleAddProfile}
        onEditBase={() => setBaseEditorOpen(true)}
        onViewRawYaml={() => setRawYamlOpen(true)}
        onImport={() => setImportOpen(true)}
        onExport={() => setExportOpen(true)}
      >
        <ProfileList
          profiles={profiles}
          loading={loading}
          error={error}
          onEdit={handleEditProfile}
          onDelete={handleDeleteProfile}
          onLaunch={handleLaunch}
          onUse={handleUse}
        />
      </Layout>

      {/* Profile Editor Dialog */}
      <ProfileEditor
        open={profileEditorOpen}
        onClose={() => setProfileEditorOpen(false)}
        profile={editingProfile}
        onSave={handleSaveProfile}
      />

      {/* Base Editor Dialog */}
      <BaseEditor
        open={baseEditorOpen}
        onClose={() => setBaseEditorOpen(false)}
        baseConfig={config?.base || {}}
        scope={scope}
      />

      {/* Raw YAML Viewer */}
      <RawYamlViewer
        open={rawYamlOpen}
        onClose={() => setRawYamlOpen(false)}
        scope={scope}
      />

      {/* Config Import */}
      <ConfigImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadData}
        scope={scope}
      />

      {/* Config Export */}
      <ConfigExport
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        scope={scope}
      />
    </ThemeProvider>
  );
}

export default App;
