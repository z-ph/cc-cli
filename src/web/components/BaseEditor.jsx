import React from 'react';
import ProfileEditor from './ProfileEditor';
import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';

function BaseEditor({ open, onClose, baseConfig, scope }) {
  const [base, setBase] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBase(baseConfig || {});
    setSaved(false);
  }, [baseConfig, open]);

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
        alert(`保存失败：${result.error}`);
      }
    } catch (err) {
      alert(`保存失败：${err.message}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>编辑 Base 配置</DialogTitle>
      <DialogContent>
        {saved && (
          <Alert severity="success" sx={{ mb: 2 }}>
            保存成功
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
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained">
          保存 Base 配置
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BaseEditor;
