const DB_NAME = 'schoolbase-offline';
const STORE_NAME = 'writes';

function openQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueWrite({ path, method, body, headers }) {
  const db = await openQueue();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      id: crypto.randomUUID(),
      path,
      method,
      body,
      headers,
      queuedAt: new Date().toISOString()
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  window.dispatchEvent(new CustomEvent('schoolbase:offline-queued'));
}

export async function pendingWrites() {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeWrite(id) {
  const db = await openQueue();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function flushWrites(send) {
  const writes = await pendingWrites();
  for (const write of writes) {
    try {
      await send(write);
      await removeWrite(write.id);
    } catch (error) {
      if (error?.status === 409 || error?.code === 'STALE_VERSION') {
        window.dispatchEvent(new CustomEvent('schoolbase:sync-conflict', { detail: { write, error } }));
      }
      break;
    }
  }
}
