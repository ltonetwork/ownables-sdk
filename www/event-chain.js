import {EventChain} from "@ltonetwork/lto/lib/events";
import * as wasm from "ownable-demo";

const EVENTS_STORE = "events";

function validateIndexedDBSupport() {
  if (!window.indexedDB) {
    console.log("Your browser doesn't support a stable version of IndexedDB.");
  }
}

export function getEventChainForOwnableId(ownable_id) {
  validateIndexedDBSupport();
  let chain = new EventChain('');
  const request = window.indexedDB.open(ownable_id);
  request.onerror = event => console.log("Can't use IndexedDB");
  request.onsuccess = event => {
    const db = event.target.result;
    const tx = db.transaction(EVENTS_STORE);
    const objectStore = tx.objectStore(EVENTS_STORE);
    objectStore.getAll()
      .onsuccess = event => {
        let latestEvent = { timestamp: 0 };
        event.target.result.forEach(
          e => {
            e = JSON.parse(e);
            if (e.timestamp > latestEvent.timestamp) {
              latestEvent = e;
            }
          }
        )
        chain.set(latestEvent);
    };
  };
  return chain;
}

export function writeEventObjToIDB(eventObj, ownable_id) {

  validateIndexedDBSupport();

  const request = window.indexedDB.open(ownable_id);
  request.onerror = () => console.error("Can't use IndexedDB");
  request.onsuccess = event => {
    const db = request.result;
    db.transaction(EVENTS_STORE, "readwrite")
      .objectStore(EVENTS_STORE)
      .put(JSON.stringify(eventObj), eventObj.hash)
      .onsuccess = event => {
        console.log("event written to db: ", eventObj)
    };
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
