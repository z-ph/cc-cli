const SENSITIVE_KEYWORDS = ['TOKEN', 'API_KEY', 'SECRET', 'AUTH_TOKEN'];

function isSensitive(key) {
  return SENSITIVE_KEYWORDS.some(kw => key.toUpperCase().includes(kw));
}

function maskToken(key, value) {
  if (!value) return '(未设置)';
  if (isSensitive(key)) {
    if (value.length <= 10) return '***';
    return value.slice(0, 6) + '***' + value.slice(-4);
  }
  return value;
}

module.exports = { maskToken, isSensitive };
