import React from 'react';
import ProfileEditor from './ProfileEditor';
import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { useLanguage } from './LanguageContext';
import { getTranslation } from '../i18n';

function BaseEditor({ open, onClose, baseConfig, scope }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(key, language);
  const [base, setBase] = useState({});
  const [saved, setSaved] = useState(false);

  // 当 baseConfig 改变或 dialog 打开时初始化数据
  useEffect(() => {
    if (open) {
      setBase(baseConfig || {});
      setSaved(false);
    }
  }, [open, baseConfig]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/base?scope=${scope}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(base),
      });
      const result = await response.json();

      if (result.success) {
        setSaved(true);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        alert(`${t('saveFailed')}: ${result.error}`);
      }
    } catch (err) {
      alert(`${t('saveFailed')}: ${err.message}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('editBaseConfig')}</DialogTitle>
      <DialogContent>
        {saved && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {t('saveSuccess')}
          </Alert>
        )}
        <ProfileEditor
          open={true}
          onClose={onClose}
          profile={{ id: 'base', ...base }}
          onSave={(id, profileData) => {
            setBase(profileData);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={handleSave} variant="contained">
          {t('saveBaseConfig')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BaseEditor;
