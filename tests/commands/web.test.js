const { createServer } = require('../../src/commands/web');
const http = require('http');

describe('web command', () => {
  describe('createServer', () => {
    let server;
    let port;

    beforeAll((done) => {
      const app = createServer();
      server = http.createServer(app);
      server.listen(0, () => {
        port = server.address().port;
        done();
      });
    });

    afterAll((done) => {
      server.close(done);
    });

    describe('GET /api/config', () => {
      it('should return empty config when no config file exists', (done) => {
        http.get(`http://localhost:${port}/api/config?scope=local`, (res) => {
          expect(res.statusCode).toBe(200);
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            const result = JSON.parse(data);
            expect(result.success).toBe(true);
            done();
          });
        });
      });
    });

    describe('GET /api/profiles', () => {
      it('should return empty array when no profiles exist', (done) => {
        http.get(`http://localhost:${port}/api/profiles?scope=local`, (res) => {
          expect(res.statusCode).toBe(200);
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            const result = JSON.parse(data);
            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);
            done();
          });
        });
      });
    });

    describe('GET /api/base', () => {
      it('should return empty base config', (done) => {
        http.get(`http://localhost:${port}/api/base?scope=local`, (res) => {
          expect(res.statusCode).toBe(200);
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            const result = JSON.parse(data);
            expect(result.success).toBe(true);
            done();
          });
        });
      });
    });
  });
});
