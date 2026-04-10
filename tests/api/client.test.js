// Set up mocks before importing modules
jest.mock('http');
jest.mock('https');

const { sendApiRequest } = require('../../src/api/client');
const http = require('http');
const https = require('https');
const EventEmitter = require('events');

describe('API Client - sendApiRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper: mock transport.request() to return a response.
   * Automatically emits 'end' after the response callback.
   */
  function mockResponse(module, responseOptions) {
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = responseOptions.statusCode || 200;
    mockRes.statusMessage = responseOptions.statusMessage || 'OK';
    mockRes.resume = jest.fn();

    module.request = jest.fn((options, callback) => {
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => mockRes.emit('end'));
      });
      return mockReq;
    });

    return { mockReq, mockRes };
  }

  /**
   * Helper: mock transport.request() that triggers an error.
   */
  function mockError(module, error) {
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    module.request = jest.fn(() => {
      process.nextTick(() => mockReq.emit('error', error));
      return mockReq;
    });

    return { mockReq };
  }

  it('should send GET request to correct URL path', async () => {
    let capturedOptions = null;
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.resume = jest.fn();

    https.request = jest.fn((options, callback) => {
      capturedOptions = options;
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => mockRes.emit('end'));
      });
      return mockReq;
    });

    await sendApiRequest('https://api.example.com/v1', 'sk-test', { path: '/models' });

    expect(capturedOptions.hostname).toBe('api.example.com');
    expect(capturedOptions.path).toBe('/v1/models');
    expect(capturedOptions.method).toBe('GET');
  });

  it('should strip trailing slash from baseUrl', async () => {
    let capturedOptions = null;
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.resume = jest.fn();

    https.request = jest.fn((options, callback) => {
      capturedOptions = options;
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => mockRes.emit('end'));
      });
      return mockReq;
    });

    await sendApiRequest('https://api.example.com/v1/', null, { path: '/models' });

    expect(capturedOptions.path).toBe('/v1/models');
  });

  it('should send both Authorization and x-api-key headers when token provided', async () => {
    let capturedHeaders = null;
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.resume = jest.fn();

    https.request = jest.fn((options, callback) => {
      capturedHeaders = options.headers;
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => mockRes.emit('end'));
      });
      return mockReq;
    });

    await sendApiRequest('https://api.example.com/v1', 'my-token', { path: '/models' });

    expect(capturedHeaders['Authorization']).toBe('Bearer my-token');
    expect(capturedHeaders['x-api-key']).toBe('my-token');
  });

  it('should not send auth headers when token is null', async () => {
    let capturedHeaders = null;
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.resume = jest.fn();

    http.request = jest.fn((options, callback) => {
      capturedHeaders = options.headers;
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => mockRes.emit('end'));
      });
      return mockReq;
    });

    await sendApiRequest('http://localhost:11434', null, { path: '/models' });

    expect(capturedHeaders['Authorization']).toBeUndefined();
    expect(capturedHeaders['x-api-key']).toBeUndefined();
  });

  it('should use http module for http:// URLs', async () => {
    mockResponse(http, { statusCode: 200, statusMessage: 'OK' });

    await sendApiRequest('http://localhost:8080', null, { path: '/models' });

    expect(http.request).toHaveBeenCalled();
    expect(https.request).not.toHaveBeenCalled();
  });

  it('should use https module for https:// URLs', async () => {
    mockResponse(https, { statusCode: 200, statusMessage: 'OK' });

    await sendApiRequest('https://api.example.com', null, { path: '/models' });

    expect(https.request).toHaveBeenCalled();
    expect(http.request).not.toHaveBeenCalled();
  });

  it('should set rejectUnauthorized:false for https', async () => {
    let capturedOptions = null;
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.resume = jest.fn();

    https.request = jest.fn((options, callback) => {
      capturedOptions = options;
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => mockRes.emit('end'));
      });
      return mockReq;
    });

    await sendApiRequest('https://self-signed.example.com', null, { path: '/models' });

    expect(capturedOptions.rejectUnauthorized).toBe(false);
  });

  it('should return statusCode, statusMessage, durationMs, and body', async () => {
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.resume = jest.fn();

    const responseBody = JSON.stringify({ data: [{ id: 'model-1' }] });

    https.request = jest.fn((options, callback) => {
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => {
          mockRes.emit('data', Buffer.from(responseBody));
          mockRes.emit('end');
        });
      });
      return mockReq;
    });

    const result = await sendApiRequest('https://api.example.com', 'token', { path: '/models' });

    expect(result.statusCode).toBe(200);
    expect(result.statusMessage).toBe('OK');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.body).toBe(responseBody);
  });

  it('should parse JSON body into data property', async () => {
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.resume = jest.fn();

    const bodyObj = { models: ['gpt-4', 'claude-3'] };

    https.request = jest.fn((options, callback) => {
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => {
          mockRes.emit('data', Buffer.from(JSON.stringify(bodyObj)));
          mockRes.emit('end');
        });
      });
      return mockReq;
    });

    const result = await sendApiRequest('https://api.example.com', 'token', { path: '/models' });

    expect(result.data).toEqual(bodyObj);
  });

  it('should set data to null when body is not valid JSON', async () => {
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.resume = jest.fn();

    https.request = jest.fn((options, callback) => {
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => {
          mockRes.emit('data', Buffer.from('not json'));
          mockRes.emit('end');
        });
      });
      return mockReq;
    });

    const result = await sendApiRequest('https://api.example.com', 'token', { path: '/models' });

    expect(result.data).toBeNull();
  });

  it('should reject on network error', async () => {
    mockError(https, new Error('Connection refused'));

    await expect(
      sendApiRequest('https://api.example.com', 'token', { path: '/models' })
    ).rejects.toThrow('Connection refused');
  });

  it('should reject on timeout', async () => {
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn((ms, callback) => {
      process.nextTick(() => callback());
    });
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    https.request = jest.fn(() => mockReq);

    await expect(
      sendApiRequest('https://api.example.com', 'token', { path: '/models', timeout: 5000 })
    ).rejects.toThrow('请求超时');

    expect(mockReq.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
    expect(mockReq.destroy).toHaveBeenCalled();
  });

  it('should use default timeout of 10000ms', async () => {
    const { mockReq } = mockResponse(https, { statusCode: 200, statusMessage: 'OK' });

    await sendApiRequest('https://api.example.com', 'token', { path: '/models' });

    expect(mockReq.setTimeout).toHaveBeenCalledWith(10000, expect.any(Function));
  });

  it('should use custom method when specified', async () => {
    let capturedOptions = null;
    const mockReq = new EventEmitter();
    mockReq.setTimeout = jest.fn();
    mockReq.destroy = jest.fn();
    mockReq.end = jest.fn();

    const mockRes = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.resume = jest.fn();

    https.request = jest.fn((options, callback) => {
      capturedOptions = options;
      process.nextTick(() => {
        callback(mockRes);
        process.nextTick(() => mockRes.emit('end'));
      });
      return mockReq;
    });

    await sendApiRequest('https://api.example.com', 'token', { path: '/models', method: 'POST' });

    expect(capturedOptions.method).toBe('POST');
  });

  it('should throw on invalid URL', async () => {
    await expect(
      sendApiRequest('not-a-valid-url', null, { path: '/models' })
    ).rejects.toThrow('无效的 URL');
  });
});
