const { createServer } = require('node:http');

function createHealthServer(isDiscordReady) {
  return createServer((request, response) => {
    if (request.url !== '/' && request.url !== '/healthz') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found\n');
      return;
    }

    const ready = isDiscordReady();
    const status = ready ? 200 : 503;
    const body = request.url === '/'
      ? ready ? 'Orbit Discord Bot is online.\n' : 'Web service is running, but the bot is not connected to Discord yet.\n'
      : ready ? 'ok\n' : 'Discord connection is not ready.\n';

    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(body);
  });
}

module.exports = { createHealthServer };