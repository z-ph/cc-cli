const http = require('http');
const https = require('https');

/**
 * Send an HTTP request to an API endpoint.
 *
 * @param {string} baseUrl - Base URL (e.g. 'https://api.example.com/v1')
 * @param {string|null} token - Auth token, or null for no auth
 * @param {object} options
 * @param {string} options.path - Request path (e.g. '/models')
 * @param {string} [options.method='GET'] - HTTP method
 * @param {number} [options.timeout=10000] - Request timeout in ms
 * @returns {Promise<{ statusCode, statusMessage, durationMs, body, data }>}
 */
function sendApiRequest(baseUrl, token, options = {}) {
  const { path: reqPath, method = 'GET', timeout = 10000, body } = options;

  return new Promise((resolve, reject) => {
    // Strip trailing slash from baseUrl
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const fullUrl = `${cleanBase}${reqPath}`;

    let parsedUrl;
    try {
      parsedUrl = new URL(fullUrl);
    } catch (err) {
      reject(new Error(`无效的 URL: ${fullUrl}`));
      return;
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const startTime = Date.now();

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-api-key'] = token;
    }
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body).toString();
    }

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
    };

    // Support self-signed certificates for HTTPS
    if (isHttps) {
      reqOptions.rejectUnauthorized = false;
    }

    const req = transport.request(reqOptions, (res) => {
      const durationMs = Date.now() - startTime;
      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try {
          data = JSON.parse(body);
        } catch {
          // Not JSON, data stays null
        }

        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          durationMs,
          body,
          data,
        });
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`请求超时 (${Math.round(timeout / 1000)}s)`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

module.exports = { sendApiRequest };
