import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Alert from '@mui/material/Alert';
import { useLanguage } from './LanguageContext';
import { getTranslation } from '../i18n';

function ConfigImport({ open, onClose, onImported, scope }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(key, language);
  const [format, setFormat] = useState('yaml');
  const [content, setContent] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleImport = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/config/import?scope=${scope}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, format }),
      });
      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onImported();
          onClose();
          setSuccess(false);
          setContent('');
        }, 1000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setContent(event.target.result);
        if (file.name.endsWith('.json')) {
          setFormat('json');
        } else {
          setFormat('yaml');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('importConfig')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            {t('uploadFile')}
          </Typography>
          <input type="file" accept=".json,.yaml,.yml" onChange={handleFileUpload} />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            {t('orPasteContent')}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('pastePlaceholder')}
          />
        </Box>

        <RadioGroup row value={format} onChange={(e) => setFormat(e.target.value)}>
          <FormControlLabel value="yaml" control={<Radio />} label="YAML" />
          <FormControlLabel value="json" control={<Radio />} label="JSON" />
        </RadioGroup>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {t('importSuccess')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={handleImport} variant="contained" disabled={!content}>
          {t('import')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfigImport;
