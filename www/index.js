import {deleteOwnable, executeOwnable, issueOwnable, syncDb, transferOwnable} from "./wasm-wrappers";
import {addOwnableOption, fetchTemplate, getOwnableType, importAssets} from "./asset_import";
import {ASSETS_STORE} from "./event-chain";
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
};

export function updateState(ownable_id, state) {
  const iframe = document.getElementById(ownable_id);
  iframe.contentWindow.postMessage({ownable_id, state}, "*");
}

export async function initializePotionHTML(ownable_id, ownableType, state) {
  return new Promise(async (resolve, reject) => {
    await injectOwnableToGrid(ownable_id, ownableType);
    const iframe = document.getElementById(ownable_id);
    iframe.onload = () => {
      console.log("iframe loaded, posting: ", {ownable_id, state});
      updateState(ownable_id, state);
      resolve();
    }
    iframe.onerror = reject();
  });
}

export async function initializeCarHTML(ownable_id) {
  return new Promise(async (resolve, reject) => {
    let ownableType = await getOwnableType(ownable_id);
    await injectOwnableToGrid(ownable_id, ownableType);
    const iframe = document.getElementById(ownable_id);
    iframe.onload = () => {
      iframe.contentWindow.postMessage({ownable_id}, "*");
      resolve();
    }
    iframe.onerror = reject();
  });
}

async function injectOwnableToGrid(ownable_id, ownableType) {
  const ownableGrid = document.getElementsByClassName("grid-container")[0];
  switch (ownableType) {
    case "template":
      ownableGrid.appendChild(await generatePotionOwnable(ownable_id, ownableType));
      break;
    case "templatecar":
      ownableGrid.appendChild(await generateVideoOwnable(ownable_id, ownableType));
      break;
  }
}

async function generateVideoOwnable(ownable_id, type) {
  // generate iframe contents
  const ownableContent = document.createElement('div');
  ownableContent.innerHTML = await getOwnableTemplate(type);
  await findMediaSources(ownableContent, type);

  // generate iframe, set contents
  const ownableIframe = document.createElement('iframe');
  ownableIframe.id = ownable_id;
  ownableIframe.sandbox = "allow-scripts";
  ownableIframe.srcdoc = ownableContent.outerHTML;
  ownableIframe.style.height = "100vh";
  // wrap iframe in a grid-item and return
  const ownableElement = document.createElement('div');
  ownableElement.classList.add('grid-item');
  ownableElement.appendChild(ownableIframe);
  return ownableElement;
}

async function generatePotionOwnable(ownable_id, type="template") {
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
  ownableElement.classList.add('grid-item');
  ownableElement.appendChild(ownableIframe);
  return ownableElement;
}

function injectOptionsDropdown(ownableHTML) {
  let dropdown = document.createElement("div");
  dropdown.innerHTML = `<div class="dropdown" style="position: absolute; top: 10px; right: 10px">
          <div class="dropdown-icon" style="font-size: 36px"><strong>&#10247;</strong></div>
          <div class="dropdown-content" style="display: none; position: absolute; z-index: 1">
            <button class="transfer-button">Transfer</button>
            <button class="delete-button">Delete</button>
          </div>
        </div>`;
  ownableHTML.appendChild(dropdown);
  // TODO: initialize listeners for transfer & delete
}

async function findMediaSources(htmlTemplate, templateName) {
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

async function replaceSources(element, db, templateName) {
  return new Promise((resolve, reject) => {
    const currentSrc = element.getAttribute("src");
    const fr = new FileReader();
    // query the idb for that img and update the template
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

function getOwnableTemplate(ownableType) {
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

function extractAttributeValue(attributes, key) {
  return attributes.filter(prop => {
    return prop.key === key
  })[0].value;
}

document.getElementsByClassName("inst-button")[0].addEventListener('click', async () => {
  document.getElementById("inst-menu").classList.toggle("show");
});

export async function instantiateOwnable(templateName) {
  return new Promise(async (resolve, reject) => {
    document.getElementById("inst-menu").classList.toggle("show");
    const ownable = await issueOwnable(templateName);
    // TODO: generalize for all ownable types
    if (templateName === "template") { // potion
      let color = extractAttributeValue(ownable.attributes, "color");
      let amount_str = extractAttributeValue(ownable.attributes, "capacity");
      let state = {
        color,
        amount: amount_str,
      };
      await initializePotionHTML(ownable.ownable_id, "template", state);
      resolve();
    } else if (templateName === "templatecar") {
      await initializeCarHTML(ownable.ownable_id);
      resolve();
    }
    reject();
  });
}

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
    case eventType.TRANSFER:
      await transferOwnable(event.data.ownable_id);
      break;
    case eventType.DELETE:
      await deleteOwnable(event.data.ownable_id);
      break;
    case eventType.EXECUTE:
      await executeOwnable(event.data.ownable_id, event.data.msg);
      break;
  }
});
