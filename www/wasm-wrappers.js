import {Event, EventChain} from "@ltonetwork/lto/lib/events";
import {
  ASSETS_STORE,
  deleteIndexedDb,
  getEvents,
  initIndexedDb,
  writeExecuteEventToIdb,
} from "./event-chain";
import {IdbStore} from "./idb-store";
import {findMediaSources, getOwnableTemplate, updateState} from "./index";
import {LTO} from '@ltonetwork/lto';
import {associateOwnableType, getOwnableType} from "./asset_import";

const lto = new LTO('T');

// maps ownableId to the worker wrapping it
let workerMap = new Map();

export async function initWorker(ownableId, ownableType) {
  return new Promise(async (resolve, reject) => {
    const bindgenDataURL = await readBindgenAsDataURL(ownableType);
    const blob = new Blob([bindgenDataURL], {type: `application/javascript`});
    // const blobURL = URL.createObjectURL(blob);
    // TODO: switch back to dynamic imports
    const worker = new Worker("./ownable_potion.js");
    worker.onmessage = (event) => {
      console.log("msg from worker:", event);
      workerMap.set(ownableId, worker);
      resolve(worker);
    };
    worker.onerror = (err) => reject(err);
    worker.onmessageerror = (err) => reject(err);
    const wasmArrayBuffer = await getBlobFromObjectStoreAsArrayBuffer(ownableType, "wasm");
    console.log("posting wasm to worker:", wasmArrayBuffer);
    worker.postMessage(wasmArrayBuffer, [wasmArrayBuffer]);
  });
}

function readBindgenAsDataURL(objectStore) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(ASSETS_STORE);
    let db;

    request.onsuccess = async () => {
      db = request.result;
      const tx = db.transaction([objectStore], "readonly")
        .objectStore(objectStore);
      let bindgen = tx.get("bindgen.js");
      bindgen.onsuccess = async (e) => {
        const fr = new FileReader();
        fr.onloadend = () => {
          db.close()
          resolve(fr.result);
        };
        fr.readAsDataURL(bindgen.result);
      }
      bindgen.onerror = (e) => reject(e);
    }
    request.onblocked = (event) => reject("idb blocked: ", event);
    request.onerror = (event) => reject("failed to open indexeddb: ", event.errorCode);
  });
}

function getBlobFromObjectStoreAsArrayBuffer(objectStore, type) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(ASSETS_STORE);
    let db;

    request.onsuccess = async () => {
      db = request.result;
      const tx = db.transaction([objectStore], "readonly")
        .objectStore(objectStore);
      let wasm_file = tx.get(type);
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
    request.onblocked = (event) => reject("idb blocked: ", event);
    request.onerror = (event) => reject("failed to open indexeddb: ", event.errorCode);
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

  let db = await initIndexedDb(ownable_id);
  // await writeExecuteEventToIdb(ownable_id, newEvent, account);


  const worker = workerMap.get(ownable_id);

  worker.addEventListener('message', async event => {
    console.log("contract executed: ", event);
    const state = JSON.parse(event.data.get('state'));
    const mem = JSON.parse(event.data.get('mem'));
    await saveOwnableStateDump(db, mem);
    queryState(ownable_id, event.data.get('mem'));
  });

  let state_dump = await getOwnableStateDump(ownable_id);

  const workerMsg = {
    type: "execute",
    ownable_id: ownable_id,
    msg: msg,
    info: getMessageInfo(),
    idb: state_dump,
  };
  console.log("posting msg: ", workerMsg);
  worker.postMessage(workerMsg);
}

function getBindgenModuleForOwnableId(ownable_id) {
  const ownableType = localStorage.getItem(ownable_id);
  return bindgenModuleMap.get(ownableType);
}

export async function deleteOwnable(ownable_id) {
  await deleteIndexedDb(ownable_id);
  localStorage.removeItem(ownable_id);
  await syncDb();
}

export function queryState(ownable_id, idbStore) {
  let msg = {
    "get_ownable_config": {},
  };
  const bindgen = getBindgenModuleForOwnableId(ownable_id);
  bindgen.query_contract_state(msg, getMessageInfo(), idbStore).then(
    (ownable) => {
      // decode binary response
      ownable = JSON.parse(atob(ownable));
      updateState(ownable_id, ownable);
    }
  );
}

export function queryMetadata(ownable_id) {
  return new Promise(async (resolve, reject) => {
    let msg = {
      "get_ownable_metadata": {},
    };
    await initIndexedDb(ownable_id);
    let idbStore = new IdbStore(ownable_id);
    const bindgen = getBindgenModuleForOwnableId(ownable_id);
    bindgen.query_contract_state(msg, getMessageInfo(), idbStore).then(
      (metadata) => {
        // decode binary response
        metadata = JSON.parse(atob(metadata));
        resolve(metadata);
      }
    );
  })
}

export async function issueOwnable(ownableType) {
  return new Promise(async (resolve, reject) => {
    // issue a new event chain
    const chain = EventChain.create(account);
    const msg = {
      ownable_id: chain.id,
    };
    localStorage.setItem(msg.ownable_id, ownableType);
    let chainIds = JSON.parse(localStorage.chainIds);
    chainIds.push(msg.ownable_id);
    localStorage.chainIds = JSON.stringify(chainIds);

    let db = await initIndexedDb(msg.ownable_id);
    let newEvent = chain.add(new Event({"@context": "instantiate_msg.json", ...msg})).signWith(account);

    await initWorker(msg.ownable_id, ownableType);
    const worker = workerMap.get(msg.ownable_id);

    worker.addEventListener('message', async event => {

      const state = JSON.parse(event.data.get('state'));
      const mem = JSON.parse(event.data.get('mem'));
      console.log(mem);
      await saveOwnableStateDump(db, mem);

      associateOwnableType(db, chain.id, ownableType).then(() => {
        db.close();
        workerMap.set(msg.ownable_id, worker);
        resolve({
          ownable_id: msg.ownable_id,
          ...state
        });
      }).catch((e) => reject(e));
    });
    const workerMsg = {
      type: "instantiate",
      ownable_id: msg.ownable_id,
      msg: msg,
      info: getMessageInfo(),
    };
    worker.postMessage(workerMsg);
  });
}

export async function saveOwnableStateDump(db, mem) {
  return new Promise(async (resolve, reject) => {
    const memSlots = mem['state_dump'];
    for (let i = 0; i < memSlots.length; i++) {
      const slot = memSlots[i];
      console.log("writing ", slot[0], slot[1]);
      let txn = db.transaction("state", "readwrite");
      let store = txn.objectStore("state");
      await store.put(slot[1], slot[0]);
      await txn.complete
    }
    resolve();
  });
}

export async function getOwnableStateDump(ownable_id) {
  return new Promise(async (resolve, reject) => {
    let db = await initIndexedDb(ownable_id);
    let respObj = {
      "state_dump": [],
    };
    let txn = db.transaction("state", "readonly").objectStore("state");
    let resp = txn.getAllKeys();
    resp.onsuccess = async () => {
      const keys = resp.result;
      for (let i = 0; i < keys.length; i++) {
        let state_dump_entry = await getIdbStateDumpEntry(db, keys[i]);
        respObj.state_dump.push(state_dump_entry);
      }

      resolve(respObj);
    }
    resp.onerror = (e) => reject(e);
  });
}

function getIdbStateDumpEntry(db, key) {
  return new Promise((resolve, reject) => {
    let txn = db.transaction("state", "readonly").objectStore("state");
    let resp = txn.get(key);
    resp.onsuccess = () => {
      let state_dump_entry = [key, resp.result];
      resolve(state_dump_entry);
    };
    resp.onerror = (e) => reject(e);
  });
}

export async function syncDb() {
  return new Promise(async (resolve, reject) => {
    const grid = document.getElementsByClassName("grid-container")[0];
    while (grid.firstChild) {
      grid.removeChild(grid.firstChild);
    }
    if (!localStorage.chainIds || workerMap.size === 0) {
      reject();
    }
    const chainIds = JSON.parse(localStorage.chainIds);
    console.log(chainIds, " are syncing");
    for (let i = 0; i < chainIds.length; i++) {
      const ownableId = chainIds[i];
      let idb = await initIndexedDb(ownableId);
      let idbStore = new IdbStore(ownableId);
      let workerMessage = {
        type: "query",
        msg: {
          "get_ownable_config": {},
        },
        info: getMessageInfo(),
        idb: idbStore,
      };
      console.log("current workers: ");
      console.log(workerMap);
      const worker = workerMap.get(ownableId);
      console.log(worker);
      worker.onmessage = (msg) => {
        console.log("msg from worker query:");
        console.log(msg);
        // TODO: parse the contract state and init
      };

      worker.postMessage(workerMessage);
    }
  });
}

export async function initializeOwnableHTML(ownable_id, state) {
  return new Promise(async (resolve, reject) => {
    const ownableType = await getOwnableType(ownable_id);
    const ownableGrid = document.getElementsByClassName("grid-container")[0];
    ownableGrid.appendChild(await generateOwnable(ownable_id, ownableType));
    const iframe = document.getElementById(ownable_id);
    iframe.onload = () => {
      console.log("iframe loaded, posting: ", {ownable_id, state});
      updateState(ownable_id, state);
      resolve();
    }
    iframe.onerror = reject();
  });
}

async function generateOwnable(ownable_id, type) {
  // generate iframe contents
  const ownableContent = document.createElement('div');
  ownableContent.innerHTML = await getOwnableTemplate(type);
  ownableContent.style.height = "100%";
  await findMediaSources(ownableContent, type);

  // generate iframe, set contents
  const ownableIframe = document.createElement('iframe');
  ownableIframe.id = ownable_id;
  ownableIframe.sandbox = "allow-scripts";
  ownableIframe.srcdoc = ownableContent.outerHTML;

  // wrap iframe in a grid-item and return
  const ownableElement = document.createElement('div');
  ownableElement.style.position = "relative";
  ownableElement.classList.add('ownable');
  ownableElement.appendChild(getOwnableActionsHTML(ownable_id));
  ownableElement.appendChild(ownableIframe);

  // wrap iframe in a grid-item and return
  const ownableGridItem = document.createElement('div');
  ownableGridItem.classList.add('grid-item');
  ownableGridItem.appendChild(ownableElement);

  return ownableGridItem;
}

function getOwnableActionsHTML(ownable_id) {
  const transferButton = document.createElement("button");
  transferButton.id = "transfer-button";
  transferButton.textContent = "Transfer";
  transferButton.addEventListener(
    'click',
    async () => await transferOwnable(ownable_id)
  );

  const deleteButton = document.createElement("button");
  deleteButton.id = "delete-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener(
    'click',
    async () => await deleteOwnable(ownable_id)
  );

  const infoButton = document.createElement("button");
  infoButton.id = "info-button";
  infoButton.textContent = "Info";
  infoButton.addEventListener(
    'click',
    async () => {
      let metadata = await queryMetadata(ownable_id);
      let events = await getEvents(ownable_id);
      let msg = `Name: ${metadata.name}\nDescription: ${metadata.description}\nEvent chain:\n`;
      for (let i = 0; i < events.length; i++) {
        msg = `${msg}${i}: ${JSON.stringify(events[i])}\n`;
      }
      window.alert(msg);
    });

  const generalActions = document.createElement("div");
  generalActions.className = "general-actions";
  generalActions.appendChild(transferButton);
  generalActions.appendChild(deleteButton);
  generalActions.appendChild(infoButton);

  const threeDots = document.createElement("div");
  threeDots.className = "three-dots";
  threeDots.id = "more-button";
  threeDots.addEventListener(
    'mouseover',
    () => { generalActions.style.display = "flex"
  });
  threeDots.addEventListener(
    'mouseout',
    () => { generalActions.style.display = "none"
  });
  threeDots.appendChild(generalActions);

  return threeDots;
}

async function initAllWasmInstances() {
  let templateNames = JSON.parse(localStorage.templates);
  console.log("initializing wasm instances: ", templateNames);
  for (let i = 0; i < templateNames.length; i++) {
    await initWasmTemplate(templateNames[i]);
  }
}

async function initIndividualOwnableInstances() {
  let ownableIds = localStorage.chainIds;
  for (let i = 0; i < ownableIds.length; i++) {
    const ownableId = ownableIds[i];
    await initWorker(ownableId, localStorage.ownableId);
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
      const bindgen = getBindgenModuleForOwnableId(ownable_id);
      bindgen.execute_contract(msg, getMessageInfo(), ownable_id, idbStore).then(
        (resp) => console.log(resp)
      )
    }
  } else {
    alert(`${addr} is not a valid address`);
  }
}

// Todo I want to be moved
let account = getAccount();
