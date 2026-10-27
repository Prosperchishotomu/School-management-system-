const { WebSocketServer } = require('ws');
const { verifyAccessToken } = require('../middleware/auth');

const clients = new Map();
let broadcaster = () => {};
let schoolBroadcaster = () => {};
let allBroadcaster = () => {};

function attachRealtime(server) {
  const websocket = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = new URL(request.url, 'http://localhost');
    const path = parsedUrl.pathname;

    // Accept /ws or / or /ws/
    if (path !== '/ws' && path !== '/ws/' && path !== '/') {
      return socket.destroy();
    }

    const token = parsedUrl.searchParams.get('token');
    const schoolIdParam = parsedUrl.searchParams.get('schoolId');

    try {
      const user = token ? verifyAccessToken(token) : { id: 'anonymous', role: 'guest', school_id: schoolIdParam };
      const schoolId = user.school_id || schoolIdParam || null;

      websocket.handleUpgrade(request, socket, head, connection => {
        connection.user = user;
        connection.schoolId = schoolId;
        clients.set(connection, { user, schoolId });

        connection.send(JSON.stringify({
          type: 'connection.ready',
          data: { user_id: user.id, school_id: schoolId }
        }));

        connection.on('close', () => clients.delete(connection));
        connection.on('error', () => clients.delete(connection));
      });
    } catch (_) {
      // In dev mode, still allow connection with guest/fallback or send 401
      websocket.handleUpgrade(request, socket, head, connection => {
        const fallbackSchool = schoolIdParam || null;
        connection.user = { id: 'guest', role: 'guest', school_id: fallbackSchool };
        connection.schoolId = fallbackSchool;
        clients.set(connection, { user: connection.user, schoolId: fallbackSchool });
        connection.send(JSON.stringify({ type: 'connection.ready', data: { user_id: 'guest', school_id: fallbackSchool } }));
        connection.on('close', () => clients.delete(connection));
        connection.on('error', () => clients.delete(connection));
      });
    }
  });

  const timer = setInterval(() => {
    clients.forEach((_, client) => {
      if (client.readyState === 1) client.ping();
    });
  }, 30000);
  timer.unref();

  broadcaster = (userIds, event) => {
    const list = Array.isArray(userIds) ? userIds : [userIds];
    clients.forEach((meta, client) => {
      if (list.includes(meta.user?.id) && client.readyState === 1) {
        client.send(JSON.stringify(event));
      }
    });
  };

  schoolBroadcaster = (schoolId, event) => {
    clients.forEach((meta, client) => {
      if ((!schoolId || !meta.schoolId || meta.schoolId === schoolId) && client.readyState === 1) {
        client.send(JSON.stringify(event));
      }
    });
  };

  allBroadcaster = (event) => {
    clients.forEach((_, client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(event));
      }
    });
  };

  return { broadcastToUsers: broadcaster, broadcastToSchool: schoolBroadcaster, broadcastAll: allBroadcaster };
}

function broadcastToUsers(userIds, event) {
  broadcaster(userIds, event);
}

function broadcastToSchool(schoolId, event) {
  schoolBroadcaster(schoolId, event);
}

function broadcastAll(event) {
  allBroadcaster(event);
}

function broadcastInvalidation(schoolId, keys, eventName = 'data_updated') {
  const targets = Array.isArray(keys) ? keys : [keys];
  const payload = {
    type: 'invalidate',
    keys: targets,
    event: eventName,
    schoolId,
    timestamp: Date.now()
  };
  schoolBroadcaster(schoolId, payload);
}

module.exports = {
  attachRealtime,
  broadcastToUsers,
  broadcastToSchool,
  broadcastAll,
  broadcastInvalidation
};
