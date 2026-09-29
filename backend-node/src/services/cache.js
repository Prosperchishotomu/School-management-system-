const { createClient } = require('redis');

let client = null;
async function connectCache() {
  if (!process.env.REDIS_URL) {
    console.log(JSON.stringify({ event: 'cache', status: 'disabled', reason: 'REDIS_URL_not_configured' }));
    return null;
  }
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', error => console.warn(JSON.stringify({ event: 'cache_error', error: error.message })));
  try { await client.connect(); console.log(JSON.stringify({ event: 'cache', status: 'connected' })); return client; }
  catch (error) { console.warn(JSON.stringify({ event: 'cache', status: 'fallback', error: error.message })); client = null; return null; }
}
function getCache() { return client; }
module.exports = { connectCache, getCache };
