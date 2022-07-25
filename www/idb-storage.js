let db;
const STATE_STORE = 'state';

async function initStateObjectStore(ownable_id) {
  const request = window.indexedDB.open(ownable_id);
  request.onupgradeneeded = () => {
    db = request.result;
    if (!db.objectStoreNames.contains(STATE_STORE)) {
      db.createObjectStore(STATE_STORE);
    }
  }
  request.onsuccess = () => {
    db = request.result;
  }
  request.onerror = (event) => console.error('failed to open indexeddb: ' + event.errorCode);
  request.onblocked = (event) => console.error("idb blocked: " + event);
}

async function get(key) {
  let tx = db.transaction(STATE_STORE, "readonly")
    .objectStore(STATE_STORE)
    .get(key);

  tx.onsuccess = () => {
    return tx.result;
  }
  tx.onerror = (err) => console.log(err);
  tx.onblocked = (err) => console.log(err);
}

async function getAllKeys() {
  let tx = db.transaction(STATE_STORE, "readonly")
    .objectStore(STATE_STORE)
    .getAllKeys();

  tx.onsuccess = () => {
    return tx.result;
  }
  tx.onerror = (err) => console.log(err);
  tx.onblocked = (err) => console.log(err);
}

async function put(k, v) {
  let tx = db.transaction(STATE_STORE, "readwrite")
    .objectStore(STATE_STORE)
    .put(v, k);

  tx.onsuccess = () => console.log(tx.result);
  tx.onerror = (err) => console.log(err);
  tx.onblocked = (err) => console.log(err);
}

async function clear() {
  let tx = db.transaction(STATE_STORE, "readwrite")
    .objectStore(STATE_STORE)
    .clear();

  tx.onsuccess = () => console.log("store cleared");
  tx.onerror = (err) => console.log(err);
}

