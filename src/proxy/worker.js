const { createProxyServer } = require('./server');

// 后台代理进程入口
// 通过命令行参数接收 JSON 配置
// 通过 IPC 通知父进程就绪
const config = JSON.parse(process.argv[2]);

const server = createProxyServer({
  baseUrl: config.baseUrl,
  modelOverride: config.modelOverride || null,
  defaultModel: config.defaultModel || null,
  token: config.token,
});

server.listen(0, () => {
  const port = server.address().port;
  // 通过 IPC 通知父进程
  if (process.send) {
    process.send({ type: 'ready', port, pid: process.pid });
  }
});

// 父进程断开后继续运行
process.on('disconnect', () => {
  // 保持进程存活
});

// 防止未捕获异常导致静默退出
process.on('uncaughtException', (err) => {
  if (process.send) {
    process.send({ type: 'error', message: err.message });
  }
  process.exit(1);
});
