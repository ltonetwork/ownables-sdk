import {findMediaSources, getOwnableTemplate, updateState} from "./index";
import {getOwnableType} from "./asset_import";
import JSONView from "./JSONView";

let worker;

addEventListener('message', async (e) => {
  let args = e.data.args;
  switch (e.data.method) {
    case "initWorker":
      await initWorker(args[0], args[1], args[2]);
      break;
    case "instantiateOwnable":
      await issueOwnable(args[0], args[1], args[2]);
      break;
    case "executeOwnable":
      await executeOwnable(args[0], args[1]);
      break;
    case "transferOwnable":
      await transferOwnable(args[0], args[1], args[2], args[3]);
      break;
    case "queryState":
      await queryState(args[0], args[1], args[2]);
      break;
    case "queryMetadata":
      await queryMetadata(args[0], args[1], args[2]);
      break;
    default:
      break;
  }
});

export async function initWorker(ownableId, javascript, wasm) {
  return new Promise(async (resolve, reject) => {

    const blob = new Blob([javascript], {type: `application/javascript`});
    const blobURL = URL.createObjectURL(blob);
    worker = new Worker(blobURL, { type: "module" });

    worker.onmessage = (event) => {
      console.log("msg from worker:", event);
      resolve(worker);
    };
    worker.onerror = (err) => reject(err);
    worker.onmessageerror = (err) => reject(err);

    const wasmBuffer = Buffer.from(wasm, "base64");

    worker.postMessage(wasmBuffer, [wasmBuffer]);
  });
}

export async function executeOwnable(ownable_id, msg) {
  worker.addEventListener('message', async event => {
    const state = JSON.parse(event.data.get('state'));
    const mem = JSON.parse(event.data.get('mem'));
    self.postMessage({state, mem})
  }, { once: true });

  worker.postMessage(msg);
}

export function queryState(ownable_id, msg, state_dump) {
  return new Promise((resolve, reject) => {
    worker.addEventListener('message', async event => {
      console.log("contract queried: ", event);
      const stateMap = (event.data.get('state'));
      const decodedState = atob(JSON.parse(stateMap));
      const state = JSON.parse(decodedState);
      updateState(ownable_id, state);
      self.postMessage(state);
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

export function queryMetadata(ownable_id, msg, state_dump) {
  return new Promise(async (resolve, reject) => {

    worker.addEventListener('message', async event => {
      console.log("contract queried: ", event);
      const metadataMap = (event.data.get('state'));
      const decodedMetadata = atob(JSON.parse(metadataMap));
      const metadata = JSON.parse(decodedMetadata);
      self.postMessage(metadata);
      resolve();
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

export async function issueOwnable(ownable_id, msg, messageInfo) {
  return new Promise(async (resolve, reject) => {

    worker.addEventListener('message', async event => {
      self.postMessage(event.data);
      resolve();
    }, { once: true });

    const workerMsg = {
      type: "instantiate",
      ownable_id: ownable_id,
      msg: msg,
      info: messageInfo,
    };
    worker.postMessage(workerMsg);
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

export async function transferOwnable(ownable_id, chainMessage, messageInfo, state_dump) {

    let workerMessage = {
      type: "execute",
      msg: chainMessage,
      info: messageInfo,
      ownable_id: ownable_id,
      idb: state_dump,
    }

    worker.onmessage = async (msg) => {
      self.postMessage(msg);
    };
    worker.postMessage(workerMessage);
}
