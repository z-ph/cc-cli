import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { Highlight, themes } from 'prism-react-renderer';

function RawYamlViewer({ open, onClose, scope }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      fetchContent();
    }
  }, [open, scope]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/config/raw?scope=${scope}`);
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>查看原始 YAML 配置</DialogTitle>
      <DialogContent sx={{ minWidth: 600, minHeight: 400 }}>
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
              maxHeight: 500,
              overflow: 'auto',
              borderRadius: 1,
            }}
          >
            <Highlight theme={themes.vsDark} code={content} language="yaml">
              {({ style, tokens, getLineProps, getTokenProps }) => (
                <pre
                  style={{
                    ...style,
                    margin: 0,
                    borderRadius: 4,
                    fontSize: 13,
                    padding: 16,
                  }}
                >
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          </Box>
        )}

        {!loading && !error && !content && (
          <Typography color="text.secondary">
            配置文件为空
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}

export default RawYamlViewer;
