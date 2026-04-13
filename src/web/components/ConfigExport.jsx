import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

function ConfigExport({ open, onClose, scope }) {
  const [format, setFormat] = useState('yaml');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      fetchContent();
    }
  }, [open, scope, format]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/config/export?scope=${scope}&format=${format}`);
      const result = await response.json();

      if (result.success) {
        setContent(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/yaml' });
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
      alert('已复制到剪贴板');
    } catch (err) {
      alert('复制失败');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>导出配置文件</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <RadioGroup
            row
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <FormControlLabel
              value="yaml"
              control={<Radio />}
              label="YAML"
            />
            <FormControlLabel
              value="json"
              control={<Radio />}
              label="JSON"
            />
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
        <Button onClick={onClose}>关闭</Button>
        <Button onClick={handleCopy}>复制</Button>
        <Button onClick={handleDownload} variant="contained">
          下载
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfigExport;
