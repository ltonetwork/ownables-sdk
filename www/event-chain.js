import {EventChain} from "@ltonetwork/lto/lib/events";

const EVENTS_STORE = "events";
const CHAIN_STORE = "chain";
const STATE_STORE = "state";
export const ASSETS_STORE = "assets";
const READ_WRITE = "readwrite";
const LATEST = "latest";

export function validateIndexedDBSupport() {
  if (!window.indexedDB) {
    console.log("Your browser doesn't support a stable version of IndexedDB.");
  }
}

export function writeExecuteEventToIdb(ownable_id, newEvent, signer) {
  validateIndexedDBSupport();
  return new Promise((resolve, reject) => {
    let chain = new EventChain('');
    const request = window.indexedDB.open(ownable_id);
    request.onsuccess = async () => {
      const db = request.result;
      const latestEventChainHash = await promisifyIdbGetTxn(db, CHAIN_STORE, LATEST);
      const latestEvent = await promisifyIdbGetTxn(db, EVENTS_STORE, latestEventChainHash);
      chain.set(JSON.parse(latestEvent));
      let signedEvent = chain.add(newEvent).signWith(signer);
      await promisifyIdbPutTxn(db, EVENTS_STORE, signedEvent.hash, JSON.stringify(signedEvent));
      await promisifyIdbPutTxn(db, CHAIN_STORE, LATEST, signedEvent.hash);
      db.close();
      resolve();
    };
    request.onerror = (e) => reject(e);
  });
}

export async function writeInstantiateEventToIdb(db, eventObj) {
  await promisifyIdbPutTxn(db, EVENTS_STORE, eventObj.hash, JSON.stringify(eventObj));
  await promisifyIdbPutTxn(db, CHAIN_STORE, LATEST, eventObj.hash);
  await promisifyIdbPutTxn(db, CHAIN_STORE, "network", "T");
}

function promisifyIdbPutTxn(db, store, key, val) {
  return new Promise((resolve, reject) => {
    const objectStore = db.transaction(store, READ_WRITE).objectStore(store);
    let txn = objectStore.put(val, key);
    txn.onsuccess = () => resolve(key);
    txn.onerror = (e) => reject(e);
  });
}

function promisifyIdbGetTxn(db, store, key) {
  return new Promise((resolve, reject) => {
    const objectStore = db.transaction(store, READ_WRITE).objectStore(store);
    let txn = objectStore.get(key);
    txn.onsuccess = () => resolve(txn.result);
    txn.onerror = (e) => reject(e);
  });
}

export function deleteIndexedDb(name) {
  return new Promise((resolve, reject) => {
    validateIndexedDBSupport();
    const chainIds = JSON.parse(localStorage.chainIds);
    const index = chainIds.indexOf(name);
    if (index !== -1) {
      chainIds.splice(index, 1);
    }
    localStorage.chainIds = JSON.stringify(chainIds);
    const request = window.indexedDB.deleteDatabase(name);

    request.onerror = () => reject("error deleting idb");
    request.onsuccess = () => {
      console.log("success deleting db");
      resolve();
    }
    request.onblocked = (e) => reject("idb blocked: ", e);
  });
}

export function initIndexedDb(ownable_id) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(ownable_id);
    let db;
    request.onupgradeneeded = () => {
      db = request.result;
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        db.createObjectStore(EVENTS_STORE);
      }
      if (!db.objectStoreNames.contains(CHAIN_STORE)) {
        db.createObjectStore(CHAIN_STORE);
      }
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE);
      }
    }
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    }
    request.onerror = (event) => reject('failed to open indexeddb: ' + event.errorCode);
    request.onblocked = (event) => reject("idb blocked: " + event)
  });
}
