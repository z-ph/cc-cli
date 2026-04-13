import React from 'react';
import { styled } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import SettingsIcon from '@mui/icons-material/Settings';

const DRAWER_WIDTH = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    minHeight: '100vh',
    boxSizing: 'border-box',
    overflow: 'auto',
  })
);

const ContentBox = styled(Box)(({ theme }) => ({
  width: '100%',
  paddingBottom: theme.spacing(10),
}));

function Layout({
  children,
  scope,
  onScopeChange,
  configPath,
  profileCount,
  onAddProfile,
  onEditBase,
  onViewRawYaml,
  onImport,
  onExport,
}) {
  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            zcc web - Profile Manager
          </Typography>
          <Typography variant="caption" sx={{ mr: 2 }}>
            {configPath ? `${configPath} | ${profileCount} profiles` : 'No config'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            top: ['48px', '56px', '64px'],
            height: 'auto',
            bottom: 0,
            borderRight: 'none',
            boxShadow: 1,
          },
        }}
      >
        <Box sx={{ overflow: 'auto' }}>
          <List>
            <ListItem>
              <ListItemText primary="Config Scope" />
            </ListItem>
            <ListItemButton
              selected={scope === 'local'}
              onClick={() => onScopeChange('local')}
            >
              <ListItemIcon>
                <Radio checked={scope === 'local'} />
              </ListItemIcon>
              <ListItemText primary="本地配置" />
            </ListItemButton>
            <ListItemButton
              selected={scope === 'global'}
              onClick={() => onScopeChange('global')}
            >
              <ListItemIcon>
                <Radio checked={scope === 'global'} />
              </ListItemIcon>
              <ListItemText primary="全局配置" />
            </ListItemButton>
          </List>

          <Divider />

          <List>
            <ListItem>
              <ListItemText primary="Actions" />
            </ListItem>
            <ListItemButton onClick={onAddProfile}>
              <ListItemIcon>
                <AddIcon />
              </ListItemIcon>
              <ListItemText primary="Add Profile" />
            </ListItemButton>
            <ListItemButton onClick={onEditBase}>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Edit Base" />
            </ListItemButton>
          </List>

          <Divider />

          <List>
            <ListItem>
              <ListItemText primary="File Operations" />
            </ListItem>
            <ListItemButton onClick={onImport}>
              <ListItemIcon>
                <UploadIcon />
              </ListItemIcon>
              <ListItemText primary="Import" />
            </ListItemButton>
            <ListItemButton onClick={onExport}>
              <ListItemIcon>
                <DownloadIcon />
              </ListItemIcon>
              <ListItemText primary="Export" />
            </ListItemButton>
            <ListItemButton onClick={onViewRawYaml}>
              <ListItemIcon>
                <TextSnippetIcon />
              </ListItemIcon>
              <ListItemText primary="View Raw YAML" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      <Main>
        <Toolbar />
        <ContentBox sx={{ mt: 2 }}>
          {children}
        </ContentBox>

        <Fab
          color="primary"
          aria-label="add"
          onClick={onAddProfile}
          sx={{
            position: 'absolute',
            bottom: 24,
            right: 24,
          }}
        >
          <AddIcon />
        </Fab>
      </Main>
    </Box>
  );
}

export default Layout;
