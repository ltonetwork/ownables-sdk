import {executeOwnable, issueOwnable, syncDb} from "./wasm-wrappers";
import {fetchTemplate, importAssets} from "./asset_import";
import {ASSETS_STORE} from "./event-chain";
// if no chainIds found, init empty
if (localStorage.getItem("chainIds") === null) {
  localStorage.chainIds = JSON.stringify([]);
}

export function updateState(ownable_id, state) {
  const iframe = document.getElementById(ownable_id);
  iframe.contentWindow.postMessage({ownable_id, state}, "*");
}

export function initializePotionHTML(ownable_id, amount, color) {
  injectPotionToGrid(ownable_id).then(() => {
    const state = {
      amount: amount,
      color: color
    };

    const iframe = document.getElementById(ownable_id);
    iframe.onload = () => iframe.contentWindow.postMessage({ownable_id, state}, "*");
  });
}

async function injectPotionToGrid(ownable_id) {
  const potionGrid = document.getElementsByClassName("grid-container")[0];

  const potionContent = document.createElement('div');
  potionContent.innerHTML = await getOwnableTemplate();
  await findImgSources(potionContent);
  const potionElement = document.createElement('div');
  potionElement.classList.add('grid-item');
  const potionIframe = document.createElement('iframe');
  potionIframe.id = ownable_id;
  potionIframe.sandbox = "allow-scripts";
  injectOptionsDropdown(potionContent);
  potionIframe.srcdoc = potionContent.outerHTML;

  potionElement.appendChild(potionIframe);
  potionGrid.appendChild(potionElement);
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

async function findImgSources(htmlTemplate) {
  return new Promise((resolve, reject) => {
    const allElements = htmlTemplate.getElementsByTagName("img");
    const request = window.indexedDB.open("assets");
    request.onblocked = (event) => console.warn("idb blocked: ", event);
    request.onerror = (event) => reject("failed to open indexeddb: ", event.errorCode);
    request.onupgradeneeded = (event) => {
      if (!request.result.objectStoreNames.contains(ASSETS_STORE)) {
        request.result.createObjectStore(ASSETS_STORE);
      }
    }
    request.onsuccess = async () => {
      let db = request.result;
      await Promise.all(
        [...allElements].map(el => replaceImage(el, db))
      );
      resolve();
    };
  });
}

async function replaceImage(element, db) {
  return new Promise((resolve, reject) => {
    const currentSrc = element.getAttribute("src");
    const fr = new FileReader();
    // query the idb for that img and update the template
    fetchTemplate(db, currentSrc).then(imgFile => {
      if (!imgFile) {
        resolve();
      }

      fr.onload = (event) => {
        element.src = event.target.result;
        resolve();
      };
      fr.readAsDataURL(imgFile);
    }, error => reject(error));
  });
}

function getOwnableTemplate() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(ASSETS_STORE);
    const reader = new FileReader();
    let db, template;
      request.onblocked = (event) => reject("idb blocked: ", event);
      request.onerror = (event) => reject("failed to open indexeddb: ", event.errorCode);
      request.onsuccess = async () => {
        db = request.result;
        template = await fetchTemplate(db, "template.html");
        reader.onload = function(evt) {
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
  const ownable = await issueOwnable();
  let color = extractAttributeValue(ownable.attributes, "color");
  let amount_str = extractAttributeValue(ownable.attributes, "capacity");
  initializePotionHTML(ownable.ownable_id, parseInt(amount_str), color);
});

document.getElementsByClassName("import-button")[0].addEventListener('click', () => importAssets());

setTimeout(() => syncDb(initializePotionHTML), 0);

window.addEventListener("message", async event => {
  if (typeof event.data.ownable_id === "undefined") return;

  if (document.getElementById(event.data.ownable_id).contentWindow !== event.source) {
    //throw Error("Not allowed to execute msg on other ownable");
  }

  await executeOwnable(event.data.ownable_id, event.data.msg);
});
