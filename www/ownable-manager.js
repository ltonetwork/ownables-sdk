import {Event, EventChain} from "@ltonetwork/lto/lib/events";
import {
  anchorEventToChain,
  ASSETS_STORE,
  deleteIndexedDb,
  getLatestChain,
  initIndexedDb,
  writeInstantiatedChainToIdb, writeLatestChain,
} from "./event-chain";
import {AccountFactoryED25519, LTO} from '@ltonetwork/lto';
import {associateOwnableType, fetchTemplate, getOwnableType} from "./asset_import";

const lto = new LTO('T');

function clearOwnableFrames() {
  const grid = document.getElementsByClassName("grid-container")[0];
  while (grid.firstChild) {
    grid.removeChild(grid.firstChild);
  }
}

async function createOwnableFrame(ownableId, ownableType) {
  if (document.getElementById(ownableId)) throw new Error(`Ownable iframe for ${ownableId} already exists`);

  const ownableGrid = document.getElementsByClassName("grid-container")[0];
  ownableGrid.appendChild(await generateOwnable(ownableId, ownableType));

  return document.getElementById(ownableId);
}

function getOwnableFrame(ownableId) {
  const frame = document.getElementById(ownableId);
  if (!frame) throw new Error(`Ownable iframe ${ownableId} doesn't exist`);

  return frame;
}

async function postToOwnableFrame(ownableId, msg) {
  return new Promise(resolve => {
    const ownableIframe = getOwnableFrame(ownableId);
    window.addEventListener('message', (e) => {
      resolve(e.data);
    }, {once: true});
    ownableIframe.contentWindow.postMessage(msg, "*");
  });
}

export async function initWorker(ownableId, ownableType) {
  const bindgenDataURL = await readBindgenAsDataURL(ownableType);
  const gluedBindgenDataURL = await appendWorkerToBindgenDataURL(bindgenDataURL);

  const wasmArrayBuffer = await getBlobFromObjectStoreAsArrayBuffer(ownableType, "wasm");
  const b64WASM = btoa(
    new Uint8Array(wasmArrayBuffer)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  const msg = {
    method: 'initWorker',
    args: [
      ownableId,
      gluedBindgenDataURL,
      b64WASM,
    ],
  };

  return postToOwnableFrame(ownableId, msg);
}

function appendWorkerToBindgenDataURL(bindgenDataURL) {
  return new Promise(async (resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const dataURLSeparator = 'base64,';
      const bindgenString = bindgenDataURL.split(dataURLSeparator);
      let newBindgenContents = fr.result + "\n" + atob(bindgenString[1]);
      resolve(newBindgenContents);
    };
    let workerGlue = await fetch("./ownable-worker.js");
    let blob = await workerGlue.blob();
    fr.readAsText(blob);
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
    const phrase = window.prompt("import seed phrase", "");
    const pw = window.prompt("Setup a password for your account", "");
    if (phrase === "") {
      account = lto.account();
    } else {
      let accountFactory = new AccountFactoryED25519('T');
      account = accountFactory.createFromSeed(phrase);
    }
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
  const state_dump = await getOwnableStateDump(ownable_id);

  const workerMsg = {
    type: "execute",
    ownable_id: ownable_id,
    msg: msg,
    info: getMessageInfo(),
    idb: state_dump,
  };

  const postMsg = {
    method: 'executeOwnable',
    args: [
      ownable_id,
      workerMsg,
    ],
  };

  const data = await postToOwnableFrame(ownable_id, postMsg);
  const mem = JSON.parse(data.get('mem'));

  let db = await initIndexedDb(ownable_id);
  await saveOwnableStateDump(db, mem);
  db.close();

  await queryState(ownable_id);

  const newEvent = new Event({"@context": "execute_msg.json", ...msg});
  const latestChain = await getLatestChain(ownable_id);
  const anchor = await anchorEventToChain(latestChain, newEvent, lto.node, account);
  await writeLatestChain(ownable_id, latestChain);
  console.log("anchor: ", anchor);
}

export async function deleteOwnable(ownable_id) {
  await deleteIndexedDb(ownable_id);
  localStorage.removeItem(ownable_id);
  await syncDb();
}

export async function queryState(ownable_id) {
  const state_dump = await getOwnableStateDump(ownable_id);

  return new Promise((resolve, reject) => {
    const ownableIframe = document.getElementById(ownable_id);

    console.log("querying contract:", state_dump);
    let msg = {
      "get_ownable_config": {},
    };

    window.addEventListener('message', async event => {
      console.log("contract queried: ", event);
      const stateMap = (event.data.get('state'));
      const decodedState = atob(JSON.parse(stateMap));
      const state = JSON.parse(decodedState);
      resolve(state);
    }, { once: true });

    const queryMsg = {
      method: "queryState",
      args: [
        ownable_id,
        msg,
        state_dump,
      ],
    };

    ownableIframe.contentWindow.postMessage(queryMsg, "*");
  });

}

export function queryMetadata(ownable_id) {
  return new Promise(async (resolve, reject) => {
    const ownableIframe = document.getElementById(ownable_id);

    let msg = {
      "get_ownable_metadata": {},
    };
    const state_dump = await getOwnableStateDump(ownable_id);

    ownableIframe.addEventListener('message', async event => {
      console.log("contract queried: ", event);
      const metadata = JSON.parse(event.data);
      resolve(metadata);
    }, { once: true });

    const workerMsg = {
      method: "queryMetadata",
      ownable_id: ownable_id,
      msg: msg,
      idb: state_dump,
    };

    ownableIframe.postMessage(workerMsg);
  })
}

export async function issueOwnable(ownableType, chain) {
  const msg = {
    ownable_id: chain.id,
  };

  const workerMsg = {
    method: "issueOwnable",
    args: [
      msg.ownable_id,
      msg,
      getMessageInfo(),
    ],
  };

  const data = await postToOwnableFrame(chain.id, workerMsg);

  const state = JSON.parse(data.get('state'));
  const mem = JSON.parse(data.get('mem'));

  return {mem, state, msg};
}

export async function createNewOwnable(templateName) {
  const chain = EventChain.create(account);
  await createOwnableFrame(chain.id, templateName);

  await initWorker(chain.id, templateName);
  const {mem, msg} = await issueOwnable(templateName, chain);

  let db = await initIndexedDb(chain.id);
  await saveOwnableStateDump(db, mem);

  const ownableType = await getOwnableType(chain.id);
  await associateOwnableType(db, chain.id, ownableType);
  reflectOwnableIssuanceInLocalStore(chain.id, ownableType);

  let newEvent = new Event({"@context": "instantiate_msg.json", ...msg});
  await anchorEventToChain(chain, newEvent, lto.node, account);
  await writeInstantiatedChainToIdb(db, chain);
  db.close();
}

async function instantiateOwnable(ownableId) {
  const ownableType = localStorage.getItem(ownableId);

  await createOwnableFrame(ownableId, ownableType);
  await initWorker(ownableId, ownableType);

  await queryState(ownableId); // Query state refreshes the widget within the ownable iframe
}

async function getInstantiateSchema(templateName) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open("assets");
    request.onblocked = (event) => reject("idb blocked: ", event);
    request.onerror = (event) => reject("failed to open indexeddb: ", event.errorCode);
    request.onupgradeneeded = (event) => {
      if (!request.result.objectStoreNames.contains(templateName)) {
        reject("no such object store");
      }
    }
    request.onsuccess = async () => {
      let db = request.result;
      const objectStore = db.transaction(templateName, "readonly").objectStore(templateName);
      const txn = objectStore.get("instantiate_msg.json");
      txn.onsuccess = () => {
        const fr = new FileReader();
        fr.onloadend = () => {
          db.close()
          resolve(fr.result);
        };
        fr.readAsText(txn.result);
      }
      txn.onerror = (e) => reject(e);
    };
  });
}

function reflectOwnableIssuanceInLocalStore(ownableId, ownableType) {
  // associate the type
  localStorage.setItem(ownableId, ownableType);
  // add to the list of existing chain ids
  let chainIds = JSON.parse(localStorage.chainIds);
  chainIds.push(ownableId);
  localStorage.chainIds = JSON.stringify(chainIds);
}

export async function saveOwnableStateDump(db, mem) {
  return new Promise(async (resolve, reject) => {
    const memSlots = mem['state_dump'];
    for (let i = 0; i < memSlots.length; i++) {
      const slot = memSlots[i];
      await writeStateDumpPair(db, slot[0], slot[1]);
    }
    resolve();
  });
}

function writeStateDumpPair(db, key, val){
  return new Promise((resolve, reject) => {
    let txn = db.transaction("state", "readwrite").objectStore("state");
    let resp = txn.put(val, key);
    resp.onsuccess = () => resolve(resp.result);
    resp.onerror = (e) => reject(e);
  });
}

export async function getOwnableStateDump(ownable_id) {
  return new Promise(async (resolve, reject) => {
    let respObj = {
      "state_dump": [],
    };

    const keys = await getStateDumpKeys(ownable_id);
    let db = await initIndexedDb(ownable_id);

    for (let i = 0; i < keys.length; i++) {
      let txn = db.transaction("state", "readonly").objectStore("state");
      let state_dump_entry = await getIdbStateDumpEntry(txn, keys[i]);
      respObj.state_dump.push(state_dump_entry);
    }
    db.close();
    resolve(respObj);
  });
}

function getStateDumpKeys(ownable_id) {
  return new Promise(async (resolve, reject) => {
    let db = await initIndexedDb(ownable_id);
    let txn = db.transaction("state", "readonly").objectStore("state");
    let resp = txn.getAllKeys();
    resp.onsuccess = () => resolve(resp.result);
    resp.onerror = (e) => reject(e);
  });
}

function getIdbStateDumpEntry(txn, key) {
  return new Promise((resolve, reject) => {
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
    if (!localStorage.chainIds) {
      reject();
    }

    clearOwnableFrames();

    const chainIds = JSON.parse(localStorage.chainIds);
    return Promise.all(chainIds.map(instantiateOwnable));
  });
}

export async function findMediaSources(htmlTemplate, templateName) {
  return new Promise((resolve, reject) => {
    const allElements = Array.from(htmlTemplate.getElementsByTagName("*")).filter(el => el.hasAttribute("src"));
    const request = window.indexedDB.open("assets");
    request.onblocked = (event) => reject("idb blocked: ", event);
    request.onerror = (event) => reject("failed to open indexeddb: ", event.errorCode);
    request.onupgradeneeded = (event) => {
      if (!request.result.objectStoreNames.contains(templateName)) {
        request.result.createObjectStore(templateName);
      }
    }
    request.onsuccess = async () => {
      let db = request.result;
      await Promise.all(
        [...allElements].map(el => replaceSources(el, db, templateName))
      );
      db.close();
      resolve();
    };
  });
}

export async function replaceSources(element, db, templateName) {
  return new Promise((resolve, reject) => {
    const currentSrc = element.getAttribute("src");
    const fr = new FileReader();
    // query the idb for that media and update the template
    fetchTemplate(db, currentSrc, templateName).then(mediaFile => {
      if (!mediaFile) {
        resolve();
      }
      fr.onload = (event) => {
        element.src = event.target.result;
        resolve();
      };
      fr.readAsDataURL(mediaFile);
    }, error => reject(error));
  });
}

export function getOwnableTemplate(ownableType) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(ASSETS_STORE);
    const reader = new FileReader();
    let db, template;
    request.onblocked = (event) => reject("idb blocked: ", event);
    request.onerror = (event) => reject("failed to open indexeddb: ", event.errorCode);
    request.onsuccess = async () => {
      db = request.result;
      template = await fetchTemplate(db, "html", ownableType);
      reader.onload = function(evt) {
        db.close();
        resolve(`${evt.target.result}`);
      };
      reader.readAsText(template);
    };
  });
}

async function generateOwnableInner(ownable_id, type) {
  // generate iframe contents
  const ownableContent = document.createElement('div');
  ownableContent.innerHTML = await getOwnableTemplate(type);
  ownableContent.style.height = "100%";
  await findMediaSources(ownableContent, type);

  // generate widget iframe
  const ownableWidget = document.createElement('iframe');
  ownableWidget.id = ownable_id;
  ownableWidget.sandbox = "allow-scripts";
  ownableWidget.srcdoc = ownableContent.outerHTML;

  const ownableScript = document.createElement('script');
  ownableScript.src = './ownable.js';

  const ownableStyle = document.createElement('style');
  ownableStyle.innerHTML = `
    html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
    iframe { height: 100%; width: 100%; border: none; }
  `;

  const ownableBody = document.createElement('body');
  ownableBody.appendChild(ownableStyle)
  ownableBody.appendChild(ownableWidget);
  ownableBody.appendChild(ownableScript);

  return ownableBody.outerHTML;
}

async function generateOwnable(ownable_id, type) {
  // generate iframe, set contents
  const ownableIframe = document.createElement('iframe');
  ownableIframe.id = ownable_id;
  ownableIframe.srcdoc = await generateOwnableInner(ownable_id, type);

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
    async () => await getOwnableInfo(ownable_id)
  );

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


export async function transferOwnable(ownable_id) {
  let addr = window.prompt("Transfer the Ownable to: ", null);
  if (lto.isValidAddress(addr)) {
    const chainMessage = {
      transfer: {
        to: addr,
      },
    };
    let metadata = await queryMetadata(ownable_id);
    if (confirm(`Are you sure you want to transfer the ownership of this ${metadata.name} ownable to ${addr}?`)) {
      const iframe = document.getElementById(ownable_id);

      const state_dump = await getOwnableStateDump(ownable_id);
      let workerMessage = {
        method: "transferOwnable",
        args: [
          ownable_id,
          chainMessage,
          getMessageInfo(),
          state_dump,
        ],
      }

      iframe.onmessage = async (msg) => {
        const newEvent = new Event({"@context": "execute_msg.json", ...chainMessage});
        const eventChain = await getLatestChain(ownable_id);
        await anchorEventToChain(eventChain, newEvent, lto.node, account);
        await writeLatestChain(ownable_id, eventChain);
      };
      iframe.postMessage(workerMessage);
    }
  } else {
    alert(`${addr} is not a valid address`);
  }
}

// Todo I want to be moved
let account = getAccount();
