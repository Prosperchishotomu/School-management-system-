const { WebSocketServer } = require('ws');
const { verifyAccessToken } = require('../middleware/auth');

const clients = new Map();
let broadcaster = () => {};

function attachRealtime(server) {
  const websocket = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    if (request.url.split('?')[0] !== '/ws') return socket.destroy();
    const token = new URL(request.url, 'http://localhost').searchParams.get('token');
    try {
      const user = verifyAccessToken(token || '');
      websocket.handleUpgrade(request, socket, head, connection => {
        connection.user = user;
        clients.set(connection, user);
        connection.send(JSON.stringify({ type: 'connection.ready', data: { user_id: user.id } }));
        connection.on('close', () => clients.delete(connection));
        connection.on('error', () => clients.delete(connection));
      });
    } catch (_) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); }
  });
  const timer = setInterval(() => clients.forEach((_, client) => { if (client.readyState === 1) client.ping(); }), 30000);
  timer.unref();
  broadcaster = (userIds, event) => clients.forEach((user, client) => { if (userIds.includes(user.id) && client.readyState === 1) client.send(JSON.stringify(event)); });
  return { broadcastToUsers: broadcaster };
}

function broadcastToUsers(userIds, event) { broadcaster(userIds, event); }
module.exports = { attachRealtime, broadcastToUsers };
