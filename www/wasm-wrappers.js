import {Event, EventChain} from "@ltonetwork/lto/lib/events";
import {
  ASSETS_STORE,
  deleteIndexedDb, initIndexedDb,
  writeExecuteEventToIdb,
  writeInstantiateEventToIdb
} from "./event-chain";
import {IdbStore} from "./idb-store";
import {findMediaSources, getOwnableTemplate, updateState} from "./index";
import {LTO} from '@ltonetwork/lto';
const lto = new LTO('T');
import {associateOwnableType, getOwnableType} from "./asset_import";

let bindgenModule;

export function initWasmTemplate(template) {
  return new Promise(async (resolve, _) => {
    const wasmBlob = await getBlobFromObjectStore(template, "wasm");
    const bindgenDataURL = await readBindgenAsDataURL(template);
    bindgenModule = await import(/* webpackIgnore: true */ bindgenDataURL);
    let initializedWasm = await bindgenModule.default(wasmBlob);
    resolve(initializedWasm);
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
      let bindgen = tx.get("bindgen");
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

function getBlobFromObjectStore(objectStore, type) {
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

  await initIndexedDb(ownable_id);
  let idbStore = new IdbStore(ownable_id);

  await writeExecuteEventToIdb(ownable_id, newEvent, account);
  bindgenModule.execute_contract(msg, getMessageInfo(), ownable_id, idbStore).then(
    (resp) => {
      queryState(ownable_id, idbStore);
    },
    (err) => window.alert("attempting to consume more than possible")
  );
}

export async function deleteOwnable(ownable_id) {
  await deleteIndexedDb(ownable_id);
  await syncDb();
}

export function queryState(ownable_id, idbStore) {
  let msg = {
    "get_ownable_config": {},
  };
  bindgenModule.query_contract_state(msg, getMessageInfo(), idbStore).then(
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
    bindgenModule.query_contract_state(msg, getMessageInfo(), idbStore).then(
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

    let chainIds = JSON.parse(localStorage.chainIds);
    chainIds.push(msg.ownable_id);
    localStorage.chainIds = JSON.stringify(chainIds);

    let db = await initIndexedDb(msg.ownable_id);
    let idbStore = new IdbStore(msg.ownable_id);

    let newEvent = chain.add(new Event({"@context": "instantiate_msg.json", ...msg})).signWith(account);
    await writeInstantiateEventToIdb(db, newEvent);
    const resp = await bindgenModule.instantiate_contract(msg, getMessageInfo(), idbStore);

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

export async function syncDb() {
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
      let msg = {
        "get_ownable_config": {},
      }
      bindgenModule.query_contract_state(msg, getMessageInfo(), idbStore).then(async contractState => {
        contractState = JSON.parse(atob(contractState));
        if (document.getElementById(chainIds[i]) === null) {
          await initializeOwnableHTML(chainIds[i], contractState);
        } else {
          console.log('potion already initialized');
        }
        idb.close();
        resolve();
      });
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
  await findMediaSources(ownableContent, type);

  // generate iframe, set contents
  const ownableIframe = document.createElement('iframe');
  ownableIframe.id = ownable_id;
  ownableIframe.sandbox = "allow-scripts";
  ownableIframe.srcdoc = ownableContent.outerHTML;

  // wrap iframe in a grid-item and return
  const ownableElement = document.createElement('div');
  ownableElement.classList.add('ownable');
  ownableElement.appendChild(ownableIframe);

  // wrap iframe in a grid-item and return
  const ownableGridItem = document.createElement('div');
  ownableGridItem.classList.add('grid-item');
  ownableGridItem.id = ownable_id;
  ownableGridItem.appendChild(ownableElement);

  // TODO
  // const generalOwnableActions = getOwnableActionsHTML(ownable_id);
  // ownableGridItem.appendChild(generalOwnableActions);

  return ownableGridItem;
}

function getOwnableActionsHTML(ownable_id) {
  const transferButton = document.createElement("button");
  transferButton.id = "transfer-button";
  transferButton.textContent = "Transfer";
  transferButton.addEventListener(
    'click',
    () => { window.parent.postMessage({type: "transfer", ownable_id}, "*")
  });

  const deleteButton = document.createElement("button");
  deleteButton.id = "delete-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener(
    'click',
    () => { window.parent.postMessage({type: "delete", ownable_id}, "*")
  });

  const infoButton = document.createElement("button");
  infoButton.id = "info-button";
  infoButton.textContent = "Info";
  infoButton.addEventListener(
    'click',
    () => { window.parent.postMessage({type: "info", ownable_id}, "*")
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
      bindgenModule.execute_contract(msg, getMessageInfo(), ownable_id, idbStore).then(
        (resp) => console.log(resp)
      )
    }
  } else {
    alert(`${addr} is not a valid address`);
  }
}

// Todo I want to be moved
let account = getAccount();
