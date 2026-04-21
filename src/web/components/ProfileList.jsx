import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ApplyIcon from '@mui/icons-material/CheckCircle';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useLanguage } from './LanguageContext';
import { getTranslation } from '../i18n';

function ProfileList({ profiles, loading, error, onEdit, onDelete, onLaunch, onUse }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(key, language);
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (profiles.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {t('noProfilesFound')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('clickToAdd')}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ mb: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>{t('env')}</TableCell>
            <TableCell>{t('permissions')}</TableCell>
            <TableCell>{t('otherConfig')}</TableCell>
            <TableCell align="right">{t('actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {profiles.map((profile) => {
            const envCount = profile.env ? Object.keys(profile.env).length : 0;
            const hasPermissions = profile.permissions ? true : false;
            const otherKeys = Object.keys(profile).filter(
              (k) => k !== 'env' && k !== 'permissions' && k !== 'id'
            );

            return (
              <TableRow key={profile.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {profile.id}
                  </Typography>
                </TableCell>
                <TableCell>
                  {envCount > 0 ? (
                    <Chip label={`${envCount} ${t('variables')}`} size="small" variant="outlined" />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('none')}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {hasPermissions ? (
                    <Chip label={t('configured')} size="small" color="success" variant="outlined" />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('none')}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {otherKeys.length > 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {otherKeys.join(', ')}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('none')}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => onEdit(profile)} title={t('edit')}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => onLaunch(profile.id)} title={t('launch')}>
                    <RocketLaunchIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => onUse(profile.id)} title={t('apply')}>
                    <ApplyIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => onDelete(profile.id)}
                    title={t('delete')}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default ProfileList;
