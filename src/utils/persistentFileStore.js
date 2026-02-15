/**
 * PersistentFileStore
 * 使用 IndexedDB 持久化已加载对话文件，避免刷新页面后丢失。
 */

const DB_NAME = 'LyraPersistentFiles';
const DB_VERSION = 1;
const STORE_NAME = 'files';

const getIndexedDB = () => {
  if (typeof window === 'undefined') return null;
  return window.indexedDB || null;
};

const requestToPromise = (request) => (
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  })
);

const transactionToPromise = (tx) => (
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  })
);

const openDatabase = async () => {
  const indexedDB = getIndexedDB();
  if (!indexedDB) {
    throw new Error('IndexedDB is not available in this environment');
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };

  return requestToPromise(request);
};

const toRecord = async (file, order) => ({
  id: `file_${order}`,
  order,
  name: file.name,
  type: file.type || 'application/json',
  lastModified: file.lastModified || Date.now(),
  content: await file.text(),
  upsertKey: file._lyraUpsertKey || '',
  syncedAt: file._lyraSyncedAt || null
});

const toFile = (record) => {
  const file = new File([record.content], record.name, {
    type: record.type || 'application/json',
    lastModified: record.lastModified || Date.now()
  });

  if (record.upsertKey) {
    file._lyraUpsertKey = record.upsertKey;
  }
  if (record.syncedAt) {
    file._lyraSyncedAt = record.syncedAt;
  }

  return file;
};

class PersistentFileStore {
  static async replaceAll(files = []) {
    const db = await openDatabase();
    try {
      const records = await Promise.all(files.map((file, index) => toRecord(file, index)));
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      records.forEach(record => store.put(record));
      await transactionToPromise(tx);
    } finally {
      db.close();
    }
  }

  static async loadAll() {
    const db = await openDatabase();
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const records = await requestToPromise(store.getAll());
      await transactionToPromise(tx);
      return (records || [])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(toFile);
    } finally {
      db.close();
    }
  }

  static async clear() {
    const db = await openDatabase();
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      await transactionToPromise(tx);
    } finally {
      db.close();
    }
  }
}

export default PersistentFileStore;
