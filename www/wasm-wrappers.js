import {Event, EventChain} from "@ltonetwork/lto/lib/events";
import {
  anchorEventToChain,
  ASSETS_STORE,
  deleteIndexedDb,
  getLatestChain,
  initIndexedDb,
  writeInstantiatedChainToIdb, writeLatestChain,
} from "./event-chain";
import {findMediaSources, getOwnableTemplate, updateState} from "./index";
import {LTO} from '@ltonetwork/lto';
import {associateOwnableType, getOwnableType} from "./asset_import";
import JSONView from "./JSONView";

const lto = new LTO('T');

// maps ownableId to the worker wrapping it
let workerMap = new Map();

export async function initWorker(ownableId, ownableType) {
  return new Promise(async (resolve, reject) => {
    const bindgenDataURL = await readBindgenAsDataURL(ownableType);

    const gluedBindgenDataURL = await appendWorkerToBindgenDataURL(bindgenDataURL);
    const blob = new Blob([gluedBindgenDataURL], {type: `application/javascript`});
    const blobURL = URL.createObjectURL(blob);
    const worker = new Worker(blobURL, { type: "module" });

    worker.onmessage = (event) => {
      console.log("msg from worker:", event);
      workerMap.set(ownableId, worker);
      resolve(worker);
    };
    worker.onerror = (err) => reject(err);
    worker.onmessageerror = (err) => reject(err);
    const wasmArrayBuffer = await getBlobFromObjectStoreAsArrayBuffer(ownableType, "wasm");
    worker.postMessage(wasmArrayBuffer, [wasmArrayBuffer]);
  });
}

function appendWorkerToBindgenDataURL(bindgenDataURL) {
  return new Promise(async (resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const dataURLSeparator = 'base64,';
      const bindgenString = bindgenDataURL.split(dataURLSeparator);
      let newBindgenContents = fr.result + "\n" + atob(bindgenString[1]);
      // in case you are testing on firefox, uncomment the next line
      // newBindgenContents = demodularizeScript(newBindgenContents);
      resolve(newBindgenContents);
    };
    let workerGlue = await fetch("./worker.js");
    let blob = await workerGlue.blob();
    fr.readAsText(blob);
  });
}

function demodularizeScript(script) {
  /*  Bindgen generated gluecode contains some export statements.
      Usually initializing the worker with { type: "module" } would permit that,
      but firefox is still in development of supporting it.
      Meanwhile this is a fix for it.
   */
  return script
    .replaceAll("export function", "function")
    .replace("export { initSync }", "")
    .replace("export default init;", "")
    .replace("new URL('ownable_potion_bg.wasm', import.meta.url);", 'null');
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

  const worker = workerMap.get(ownable_id);
  const state_dump = await getOwnableStateDump(ownable_id);

  worker.addEventListener('message', async event => {
    console.log("contract executed: ", event);
    const state = JSON.parse(event.data.get('state'));
    const mem = JSON.parse(event.data.get('mem'));

    let db = await initIndexedDb(ownable_id);
    await saveOwnableStateDump(db, mem);
    db.close();

    await queryState(ownable_id, await getOwnableStateDump(ownable_id));
    const newEvent = new Event({"@context": "execute_msg.json", ...msg});
    const latestChain = await getLatestChain(ownable_id);
    const anchor = await anchorEventToChain(latestChain, newEvent, lto.node, account);
    await writeLatestChain(ownable_id, latestChain);
    console.log("anchor: ", anchor);
  }, { once: true });

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

export async function deleteOwnable(ownable_id) {
  await deleteIndexedDb(ownable_id);
  localStorage.removeItem(ownable_id);
  await syncDb();
}

export function queryState(ownable_id, state_dump) {
  return new Promise((resolve, reject) => {
    console.log("querying contract:", state_dump);
    let msg = {
      "get_ownable_config": {},
    };

    const worker = workerMap.get(ownable_id);

    worker.addEventListener('message', async event => {
      console.log("contract queried: ", event);
      const stateMap = (event.data.get('state'));
      const decodedState = atob(JSON.parse(stateMap));
      const state = JSON.parse(decodedState);
      updateState(ownable_id, state);
      resolve();
    }, { once: true });

    const workerMsg = {
      type: "query",
      ownable_id: ownable_id,
      msg: msg,
      idb: state_dump,
    };

    worker.postMessage(workerMsg);
  });

}

export function queryMetadata(ownable_id) {
  return new Promise(async (resolve, reject) => {
    let msg = {
      "get_ownable_metadata": {},
    };

    const state_dump = await getOwnableStateDump(ownable_id);
    const worker = workerMap.get(ownable_id);

    worker.addEventListener('message', async event => {
      console.log("contract queried: ", event);
      const metadataMap = (event.data.get('state'));
      const decodedMetadata = atob(JSON.parse(metadataMap));
      const metadata = JSON.parse(decodedMetadata);
      resolve(metadata);
    }, { once: true });

    const workerMsg = {
      type: "query",
      ownable_id: ownable_id,
      msg: msg,
      idb: state_dump,
    };

    worker.postMessage(workerMsg);
  })
}

export async function issueOwnable(ownableType) {
  return new Promise(async (resolve, reject) => {
    // issue a new event chain
    const chain = EventChain.create(account);
    const msg = {
      ownable_id: chain.id,
    };
    await initWorker(msg.ownable_id, ownableType);
    const worker = workerMap.get(msg.ownable_id);

    worker.addEventListener('message', async event => {

      const state = JSON.parse(event.data.get('state'));
      const mem = JSON.parse(event.data.get('mem'));
      let db = await initIndexedDb(msg.ownable_id);
      await saveOwnableStateDump(db, mem);

      associateOwnableType(db, chain.id, ownableType).then(async () => {
        workerMap.set(msg.ownable_id, worker);
        reflectOwnableIssuanceInLocalStore(msg.ownable_id, ownableType);
        let newEvent = new Event({"@context": "instantiate_msg.json", ...msg});
        await anchorEventToChain(chain, newEvent, lto.node, account);
        await writeInstantiatedChainToIdb(db, chain);
        db.close();
        resolve({
          ownable_id: msg.ownable_id,
          ...state
        });
      }).catch((e) => reject(e));
    }, { once: true });

    const workerMsg = {
      type: "instantiate",
      ownable_id: msg.ownable_id,
      msg: msg,
      info: getMessageInfo(),
    };
    worker.postMessage(workerMsg);
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
    const grid = document.getElementsByClassName("grid-container")[0];
    while (grid.firstChild) {
      grid.removeChild(grid.firstChild);
    }
    if (!localStorage.chainIds) {
      reject();
    }
    const chainIds = JSON.parse(localStorage.chainIds);
    console.log(chainIds, " are syncing");
    for (let i = 0; i < chainIds.length; i++) {
      const ownableId = chainIds[i];
      const state_dump = await getOwnableStateDump(ownableId);
      let workerMessage = {
        type: "query",
        msg: {
          "get_ownable_config": {},
        },
        info: getMessageInfo(),
        idb: state_dump,
      };

      if (!workerMap.has(ownableId)) {
        const ownableType = localStorage.getItem(ownableId);
        await initWorker(ownableId, ownableType);
      }

      const worker = workerMap.get(ownableId);

      worker.onmessage = async (msg) => {
        const stateMap = (msg.data.get('state'));
        const decodedState = atob(JSON.parse(stateMap));
        const state = JSON.parse(decodedState);
        if (document.getElementById(chainIds[i]) === null) {
          await initializeOwnableHTML(chainIds[i], state);
        } else {
          console.log('ownable already initialized');
        }
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

async function getOwnableInfo(ownable_id) {
  let metadata = await queryMetadata(ownable_id);
  let latestChain = await getLatestChain(ownable_id);
  const events = latestChain.events;
  const modalContent = document.createElement('div');
  modalContent.className = 'event-chain-modal';

  const header = document.createElement('h2');
  header.innerText = metadata.name;
  const description = document.createElement('h4');
  description.innerText = metadata.description;
  const id = document.createElement('h5');
  id.innerText = `ID: ${ownable_id}`;
  modalContent.appendChild(header);
  modalContent.appendChild(description);
  modalContent.appendChild(id);

  const eventsHeader = document.createElement('h3');
  eventsHeader.innerText = (events.length) ? "Events:" : "No events found.";
  modalContent.appendChild(eventsHeader);


  for (let i = 0; i < events.length; i++) {
    const eventJSON = events[i].toJSON();
    const eventHTML = buildHTMLForEventDisplay(i, eventJSON);
    let connectorDiv = document.createElement('div');
    if (i > 0) {
      connectorDiv = buildConnectorHTML(events[i - 1].toJSON().hash, eventJSON.previous);
    }

    connectorDiv.className = 'chain-connector';
    modalContent.appendChild(connectorDiv);
    modalContent.appendChild(eventHTML);
  }

  if (events.length > 0) {
    modalContent.appendChild(buildConnectorHTML(events[events.length - 1].toJSON().hash, null));
  }

  const modal = document.getElementById('event-chain-modal');

  modal.getElementsByClassName("modal-container")[0].appendChild(modalContent);
  modal.classList.add('open');

  const exits = modal.querySelectorAll('.modal-bg, .close');
  exits.forEach(function (exit) {
    exit.addEventListener('click', function (event) {
      event.preventDefault();
      modal.classList.remove('open');
      modal.getElementsByClassName("modal-container")[0].removeChild(modalContent);
    });
  });
}

function buildConnectorHTML(hash, previous) {
  const connectorDiv = document.createElement('div');
  connectorDiv.className = 'chain-connector';

  if (hash) {
    const hashDiv = document.createElement('div');
    hashDiv.className = 'connector-hash truncate';
    hashDiv.innerHTML = `<strong>HASH:</strong><i>${hash}</i>`;
    connectorDiv.append(hashDiv);
  }

  if (previous) {
    const link = document.createElement('div');
    link.className = 'connector-link';
    link.innerHTML = '&#128279;';

    const previousDiv = document.createElement('div');
    previousDiv.className = 'connector-previous truncate';
    previousDiv.innerHTML = `<strong>Previous:</strong><i>${previous}</i>`
    connectorDiv.append(link, previousDiv);
  }

  return connectorDiv;
}

function buildHTMLForEventDisplay(index, event) {
  const eventElement = document.createElement('div');
  eventElement.className = `event-chain event-${index}`;

  const timestamp = document.createElement('div');
  timestamp.innerHTML = `<strong>Date: </strong><i>${new Date(event.timestamp)}</i>`;

  const signature = document.createElement('div');
  signature.className = 'truncate';
  signature.innerHTML = `<strong>Event signature: </strong><i>${event.signature}</i>`;

  const signer = document.createElement('div');
  signer.className = 'truncate';
  signer.innerHTML = `<strong>Signer: </strong><i>${event.signKey.publicKey}</i>`;

  const mediaType = document.createElement('div');
  mediaType.innerHTML = `<strong>Media type: </strong><i>${event.mediaType}</i>`;

  const body = document.createElement('div');
  const toggleSwitch = getToggleSwitch(index);
  const toggleCheckbox = toggleSwitch.firstChild;

  const b64 = document.createElement('div');
  b64.innerHTML = event.data.toString();
  b64.className = `data-b64 truncate`;

  let jsonViewer = document.createElement('div');
  let eventData = event.data.toString();
  if (eventData.startsWith('base64:')) {
    eventData = eventData.substring(7);
    try {
      eventData = JSON.parse(atob(eventData));
      if (eventData instanceof Object) {
        var view = new JSONView('body', eventData);
        view.collapse();

        jsonViewer.className = `data-json`;
        jsonViewer.appendChild(view.dom);
      }
    } catch (e) {
      console.log("b64 does not decode into json");
      jsonViewer = undefined;
      toggleCheckbox.disabled = true;
    }
  }

  const bodyContent = document.createElement('div');
  bodyContent.appendChild(b64);

  body.style.lineHeight = '20px';
  body.innerHTML = `<strong>Event body</strong>:`;
  body.appendChild(toggleSwitch);
  body.appendChild(bodyContent);

  toggleCheckbox.addEventListener('click', () => {
    bodyContent.innerHTML = '';
    if (toggleCheckbox.value === 'json') {
      toggleCheckbox.value = 'b64';
      bodyContent.appendChild(b64);
      toggleSwitch.getElementsByClassName('b64-on')[0].style.display = 'block';
      toggleSwitch.getElementsByClassName('json-on')[0].style.display = 'none';
    } else if (jsonViewer !== undefined) {
      toggleCheckbox.value = 'json';
      bodyContent.appendChild(jsonViewer);
      toggleSwitch.getElementsByClassName('b64-on')[0].style.display = 'none';
      toggleSwitch.getElementsByClassName('json-on')[0].style.display = 'block';
    }
  });

  eventElement.append(timestamp, signature, signer, mediaType, body);

  return eventElement;
}

function getToggleSwitch(id) {

  const inputElement = document.createElement('input');
  inputElement.type = 'checkbox';
  inputElement.id = `checkbox-id-${id}`;
  inputElement.name = `checkbox-${id}`;
  inputElement.value = 'b64';

  const label = document.createElement('label');
  label.htmlFor = `checkbox-id-${id}`;
  label.className = 'switch';

  const slider = document.createElement('span');
  slider.className = 'slider round';
  const jsonText = document.createElement('span');
  jsonText.className = 'json-on';
  jsonText.innerHTML = 'JSON';
  const b64Text = document.createElement('span');
  b64Text.className = 'b64-on';
  b64Text.innerHTML = 'B64';
  slider.append(jsonText, b64Text);

  label.append(inputElement, slider);
  return label;
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
      const worker = workerMap.get(ownable_id);

      const state_dump = await getOwnableStateDump(ownable_id);
      let workerMessage = {
        type: "execute",
        msg: chainMessage,
        info: getMessageInfo(),
        ownable_id: ownable_id,
        idb: state_dump,
      }

      worker.onmessage = async (msg) => {
        const newEvent = new Event({"@context": "execute_msg.json", ...chainMessage});
        const eventChain = await getLatestChain(ownable_id);
        await anchorEventToChain(eventChain, newEvent, lto.node, account);
        await writeLatestChain(ownable_id, eventChain);
      };
      worker.postMessage(workerMessage);
    }
  } else {
    alert(`${addr} is not a valid address`);
  }
}

// Todo I want to be moved
let account = getAccount();
