import React, { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useLanguage } from './LanguageContext';
import { getTranslation } from '../i18n';

function ConfigExport({ open, onClose, scope }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(key, language);
  const [format, setFormat] = useState('yaml');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/config/export?scope=${scope}&format=${format}`);
      const result = await response.json();

      if (result.success) {
        setContent(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError(t('fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [scope, format, language]);

  useEffect(() => {
    if (open) {
      fetchContent();
    }
  }, [open, fetchContent]);

  const handleDownload = () => {
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/yaml',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `models.${format === 'json' ? 'json' : 'yaml'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      alert(t('copySuccess'));
    } catch {
      alert(t('copyFailed'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('exportConfig')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <RadioGroup row value={format} onChange={(e) => setFormat(e.target.value)}>
            <FormControlLabel value="yaml" control={<Radio />} label="YAML" />
            <FormControlLabel value="json" control={<Radio />} label="JSON" />
          </RadioGroup>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && content && (
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              fontFamily: 'monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 300,
              overflow: 'auto',
              bgcolor: 'background.default',
            }}
          >
            {content}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('close')}</Button>
        <Button onClick={handleCopy}>{t('copy')}</Button>
        <Button onClick={handleDownload} variant="contained">
          {t('download')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfigExport;
