import {EventChain} from "@ltonetwork/lto/lib/events";
import {syncDb} from "./wasm-wrappers";

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
    request.onsuccess = () => {
      const db = request.result;
      // grab the latest event from the chain
      let chainTx = db.transaction(CHAIN_STORE).objectStore(CHAIN_STORE).get(LATEST);
      chainTx.onsuccess = () => {
        const latestEventChainHash = chainTx.result;
        let eventChainTx = db.transaction(EVENTS_STORE).objectStore(EVENTS_STORE).get(latestEventChainHash);
        eventChainTx.onsuccess = () => {
          chain.set(JSON.parse(eventChainTx.result));
          // append the new event to the previous head and sign
          let signedEvent = chain.add(newEvent).signWith(signer);
          let putEventTx = db.transaction(EVENTS_STORE, READ_WRITE)
            .objectStore(EVENTS_STORE).put(JSON.stringify(signedEvent), signedEvent.hash);
          putEventTx.onsuccess = () => {
            let putChainTx = db.transaction(CHAIN_STORE, READ_WRITE)
              .objectStore(CHAIN_STORE).put(signedEvent.hash, LATEST);
            putChainTx.onsuccess = () => resolve(request.result);
          };
        };
      };
    }
    request.onerror = (event) => reject('failed to open indexeddb: ' + event.errorCode);
    request.onblocked = (event) => reject("idb blocked: " + event);
  });
}

export function writeInstantiateEventToIdb(db, eventObj) {

  const eventsTx = db.transaction(EVENTS_STORE, READ_WRITE)
    .objectStore(EVENTS_STORE)
    .put(JSON.stringify(eventObj), eventObj.hash);
  const chainTx = db.transaction(CHAIN_STORE, READ_WRITE)
    .objectStore(CHAIN_STORE)
    .put(eventObj.hash, LATEST);
  const chainNetworkTx = db.transaction(CHAIN_STORE, READ_WRITE)
    .objectStore(CHAIN_STORE)
    .put('T', "network");

  eventsTx.onsuccess = () => console.log("events object store updated");
  chainTx.onsuccess = () => console.log("chain object store updated");
  chainNetworkTx.onsuccess = () => console.log("chain object store updated");
}

export function deleteIndexedDb(name) {
  validateIndexedDBSupport();
  const chainIds = JSON.parse(localStorage.chainIds);
  const index = chainIds.indexOf(name);
  if (index !== -1) {
    chainIds.splice(index, 1);
  }
  localStorage.chainIds = JSON.stringify(chainIds);

  const request = window.indexedDB.deleteDatabase(name);

  request.onerror = () => console.log("error deleting idb");
  request.onsuccess = async () => {
    console.log("success deleting db");
    await syncDb();
  }
  request.onblocked = (e) => console.log("idb blocked: ", e);
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
      if (!request.result.objectStoreNames.contains(STATE_STORE)) {
        request.result.createObjectStore(STATE_STORE);
      }
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject('failed to open indexeddb: ' + event.errorCode);
    request.onblocked = (event) => reject("idb blocked: " + event)
  });
}
