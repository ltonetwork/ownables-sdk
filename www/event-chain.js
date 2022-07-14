import {EventChain} from "@ltonetwork/lto/lib/events";
import * as wasm from "ownable-demo";

const EVENTS_STORE = "events";
const CHAIN_STORE = "chain";
const READ_WRITE = "readwrite";
const LATEST = "latest";

function validateIndexedDBSupport() {
  if (!window.indexedDB) {
    console.log("Your browser doesn't support a stable version of IndexedDB.");
  }
}

export function writeExecuteEventToIdb(ownable_id, newEvent, signer) {

  validateIndexedDBSupport();
  let chain = new EventChain('');
  const request = window.indexedDB.open(ownable_id);

  request.onerror = () => console.log("Can't use IndexedDB");
  request.onsuccess = event => {
    const db = request.result;
    // grab the latest event from the chain
    let chainTx = db.transaction(CHAIN_STORE).objectStore(CHAIN_STORE).get(LATEST);
    chainTx.onsuccess = () => {
      const latestEventChainHash = chainTx.result;
      let eventChainTx = db.transaction(EVENTS_STORE)
        .objectStore(EVENTS_STORE)
        .get(latestEventChainHash);
      eventChainTx.onsuccess = () => {
        chain.set(JSON.parse(eventChainTx.result));
        // append the new event to the previous head and sign
        let signedEvent = chain.add(newEvent).signWith(signer);
        let putEventTx = db.transaction(EVENTS_STORE, READ_WRITE)
          .objectStore(EVENTS_STORE).put(JSON.stringify(signedEvent), signedEvent.hash);
        let putChainTx = db.transaction(CHAIN_STORE, READ_WRITE)
          .objectStore(CHAIN_STORE).put(signedEvent.hash, LATEST);
        putEventTx.onsuccess = () => console.log("events object store updated");
        putChainTx.onsuccess = () => console.log("chain object store updated");
      };
    };
  }
}

export function writeInstantiateEventToIdb(eventObj, ownable_id) {

  validateIndexedDBSupport();
  const request = window.indexedDB.open(ownable_id);

  request.onerror = () => console.error("Can't use IndexedDB");
  request.onsuccess = () => {
    const db = request.result;
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
  };
}

export async function syncDb(initializePotionHTML) {

  validateIndexedDBSupport();
  const chainIds = JSON.parse(localStorage.chainIds);

  for (let i = 0; i < chainIds.length; i++) {
    wasm.query_contract_state(chainIds[i]).then(
      (resp) => {
        if (document.getElementById(chainIds[i]) === null) {
          initializePotionHTML(chainIds[i], resp.current_amount, resp.color_hex);
        } else {
          console.log('potion already initialized');
        }
      },
      (err) => console.log("something went wrong")
    );
  }
}
