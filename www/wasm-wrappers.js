import {Event, EventChain} from "@ltonetwork/lto/lib/events";
import {
  ASSETS_STORE,
  deleteIndexedDb, initIndexedDb,
  writeExecuteEventToIdb,
  writeInstantiateEventToIdb
} from "./event-chain";
import {IdbStore} from "./idb-store";
import {initializePotionHTML, updateState} from "./index";
import {LTO} from '@ltonetwork/lto';
const lto = new LTO('T');
import init, { instantiate_contract, query_contract_state, execute_contract } from './wasm-glue.js';
import {associateOwnableType} from "./asset_import";

export function initWasmTemplate(template) {
  return new Promise((resolve, reject) => {
    getWasmBlob(template).then(async arrayBuffer => {
      let initializedWasm = await init(arrayBuffer);
      resolve(initializedWasm);
    }).catch((e) => reject(e));
  });
}

function getWasmBlob(template) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(ASSETS_STORE);
    let db;
    request.onblocked = (event) => reject("idb blocked: ", event);
    request.onerror = (event) => reject("failed to open indexeddb: ", event.errorCode);
    request.onsuccess = async () => {
      db = request.result;
      const objectStore = db.transaction([template], "readonly")
        .objectStore(template);
      let wasm_file = objectStore.get('wasm');
      wasm_file.onsuccess = async (e) => {
        const fr = new FileReader();
        fr.onload = () => {
          db.close();
          resolve(fr.result);
        };
        fr.readAsArrayBuffer(e.target.result);
      }
      wasm_file.onerror = (e) => reject(e);
    }
  });
}

function getAccount() {
  let existingSeed = localStorage.encryptedSeed;
  let account;
  if (existingSeed === undefined) {
    const pw = window.prompt("Setup a password for your account", "");
    account = lto.account();
    localStorage.encryptedSeed = account.encryptSeed(pw);
  } else {
    account = attemptToDecryptSeed(existingSeed);
  }
  return account;
}

function attemptToDecryptSeed(seed, promptMsg = "Enter your password") {
  let account;
  while (account === undefined) {
    const pw = window.prompt(promptMsg, "");
    const settings = {
      seed: seed,
      seedPassword: pw,
    };
    try {
      account = lto.account(settings);
      window.alert("Successfully authenticated");
      return account;
    } catch (e) {
      promptMsg = "Invalid password, try again";
    }
  }
}

function getMessageInfo() {
  return {
    sender: account.address,
    funds: [],
  }
}

export async function executeOwnable(ownable_id, msg) {
  const newEvent = new Event({"@context": "execute_msg.json", ...msg});

  await initIndexedDb(ownable_id);
  let idbStore = new IdbStore(ownable_id);

  await writeExecuteEventToIdb(ownable_id, newEvent, account);
  execute_contract(msg, getMessageInfo(), ownable_id, idbStore).then(
    (resp) => {
      queryState(ownable_id, idbStore);
    },
    (err) => window.alert("attempting to consume more than possible")
  );
}

export async function deleteOwnable(ownable_id) {
  await deleteIndexedDb(ownable_id);
  await syncDb(initializePotionHTML);
}

export function queryState(ownable_id, idbStore) {
  query_contract_state(idbStore).then(
    (ownable) => {
      updateState(ownable_id, {
        amount: ownable.current_amount,
        color: ownable.color_hex,
      });
    }
  );
}

export async function issueOwnable(ownableType) {
  return new Promise(async (resolve, reject) => {
    // issue a new event chain
    const chain = EventChain.create(account);
    const msg = {
      ownable_id: chain.id,
    };

    let chainIds = JSON.parse(localStorage.chainIds);
    chainIds.push(msg.ownable_id);
    localStorage.chainIds = JSON.stringify(chainIds);

    let db = await initIndexedDb(msg.ownable_id);
    let idbStore = new IdbStore(msg.ownable_id);

    let newEvent = chain.add(new Event({"@context": "instantiate_msg.json", ...msg})).signWith(account);
    await writeInstantiateEventToIdb(db, newEvent);
    const resp = await instantiate_contract(msg, getMessageInfo(), idbStore);

    if (resp) {
      await associateOwnableType(db, chain.id, ownableType);
    } else {
      reject();
    }
    await db.close();

    resolve({
      ownable_id: msg.ownable_id,
      ...JSON.parse(resp)
    });
  });
}

export async function syncDb(callback) {
  return new Promise(async (resolve, reject) => {
    const grid = document.getElementsByClassName("grid-container")[0];
    while (grid.firstChild) {
      grid.removeChild(grid.firstChild);
    }
    if (!localStorage.chainIds) {
      reject();
    }
    await initAllWasmInstances();
    const chainIds = JSON.parse(localStorage.chainIds);
    console.log(chainIds, " are syncing");
    for (let i = 0; i < chainIds.length; i++) {
      let idb = await initIndexedDb(chainIds[i]);
      let idbStore = new IdbStore(chainIds[i]);
      let contractState = await query_contract_state(idbStore);
      if (document.getElementById(chainIds[i]) === null) {
        await callback(chainIds[i], contractState.current_amount, contractState.color_hex);
      } else {
        console.log('potion already initialized');
      }
      idb.close();
      resolve();
    }
  });
}

async function initAllWasmInstances() {
  let templateNames = JSON.parse(localStorage.templates);
  for (let i = 0; i < templateNames.length; i++) {
    await initWasmTemplate(templateNames[i]);
  }
}

export async function transferOwnable(ownable_id) {
  let addr = window.prompt("Transfer the Ownable to: ", null);
  if (lto.isValidAddress(addr)) {
    const msg = {
      transfer: {
        to: addr,
      },
    };
    if (confirm(`Confirm:\n${JSON.stringify(msg)}`)) {
      await initIndexedDb(ownable_id);
      let idbStore = new IdbStore(ownable_id);
      execute_contract(msg, getMessageInfo(), ownable_id, idbStore).then(
        (resp) => console.log(resp)
      )
    }
  } else {
    alert(`${addr} is not a valid address`);
  }
}

// Todo I want to be moved
let account = getAccount();
