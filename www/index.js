import {
  _instantiateOwnable,
  executeOwnable,
  initializeOwnableHTML, initWorker,
  issueOwnable, queryMetadata,
  syncDb,
} from "./ownable-manager";
import {addOwnableOption, fetchTemplate, importAssets} from "./asset_import";
import {ASSETS_STORE, getLatestChain} from "./event-chain";
import JSONView from "./JSONView";

// if no chainIds found, init empty
if (localStorage.getItem("chainIds") === null) {
  localStorage.chainIds = JSON.stringify([]);
}
if (localStorage.getItem("templates") === null) {
  localStorage.templates = JSON.stringify([]);
} else {
  let templates = JSON.parse(localStorage.getItem("templates"));
  templates.forEach(
    t => addOwnableOption(t)
  );
}

const eventType = {
  TRANSFER: "transfer",
  DELETE: "delete",
  EXECUTE: "execute",
  INFO: "info",
};


document.getElementById("inst").addEventListener('click', async event => {
  event.preventDefault();
  const modal = document.getElementById('inst-modal');
  modal.classList.add('open');
  const exits = modal.querySelectorAll('.modal-bg, .instantiate-selection button');
  exits.forEach(function (exit) {
    exit.addEventListener('click', function (event) {
      event.preventDefault();
      modal.classList.remove('open');
    });
  });
});

document.getElementsByClassName("import-button")[0].addEventListener('click', () => importAssets());

setTimeout(async () => {
  if (localStorage.templates) {
    await syncDb();
  }
}, 0);

window.addEventListener("message", async event => {
  if (typeof event.data.ownable_id === "undefined") return;
  if (document.getElementById(event.data.ownable_id).contentWindow !== event.source) {
    throw Error("Not allowed to execute msg on other ownable");
  }
  switch (event.data.type) {
    case eventType.EXECUTE:
      await executeOwnable(event.data.ownable_id, event.data.msg);
      break;
    default:
      console.log("unknown msg");
      break;
  }
});

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
