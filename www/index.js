import {consumeOwnable, deleteOwnable, executeOwnable, issueOwnable, syncDb, transferOwnable} from "./wasm-wrappers";
import {fetchTemplate, importAssets} from "./asset_import";
import {ASSETS_STORE} from "./event-chain";
// if no chainIds found, init empty
if (localStorage.getItem("chainIds") === null) {
  localStorage.chainIds = JSON.stringify([]);
}

// export function getDrinkAmount(ownable_id) {
//   let stringAmount = document.getElementById(ownable_id)
//     .getElementsByClassName('slider')[0].valueOf().value;
//   return parseInt(stringAmount);
// }

export function updateState(ownable_id, state) {
  const ownableWindow = document.getElementById(ownable_id).contentWindow;
  ownableWindow.onload = () => ownableWindow.postMessage({ownable_id, state}, "*");
}

export function initializePotionHTML(ownable_id, state) {
  injectPotionToGrid(ownable_id).then(() => {
    updateState(ownable_id, state);

    const ownableHTML = document.getElementById(ownable_id);

    /*ownableHTML.getElementsByClassName("transfer-button")[0]
      .addEventListener('click', () => transferOwnable(ownable_id));
    ownableHTML.getElementsByClassName("delete-button")[0]
      .addEventListener('click', () => {
        if (confirm("Are you sure you want to delete this Ownable?")) {
          deleteOwnable(ownable_id);
          ownableHTML.parentElement.remove();
        }
      });*/
  });
}

async function injectPotionToGrid(ownable_id) {
  const potionGrid = document.getElementsByClassName("grid-container")[0];

  const potionContent = document.createElement('div');
  potionContent.innerHTML = await getOwnableTemplate();
  findImgSources(potionContent.firstChild);

  const potionElement = document.createElement('div');
  potionElement.classList.add('grid-item');
  const potionIframe = document.createElement('iframe');
  potionIframe.id = ownable_id;
  potionIframe.srcdoc = potionContent.innerHTML;
  potionElement.appendChild(potionIframe);

  potionGrid.appendChild(potionElement);
}

function findImgSources(htmlTemplate) {
  let allElements = htmlTemplate.getElementsByTagName("*");
  const request = window.indexedDB.open("assets");
  request.onblocked = (event) => console.log("idb blocked: ", event);
  request.onerror = (event) => console.log("failed to open indexeddb: ", event.errorCode);
  request.onupgradeneeded = (event) => {
    if (!request.result.objectStoreNames.contains(ASSETS_STORE)) {
      request.result.createObjectStore(ASSETS_STORE);
    }
  }
  request.onsuccess = async () => {
    let db = request.result;
    for (const element of allElements) {
      // for each image tag within the html template..
      if (element.tagName === "IMG") {
        const currentSrc = element.getAttribute("src");
        const fr = new FileReader();
        // query the idb for that img and update the template
        let imgFile = await fetchTemplate(db, currentSrc);
        fr.onload = (event) => {
          element.src = event.target.result;
        };
        if (imgFile) {
          fr.readAsDataURL(imgFile);
        }
      }
    }
  };
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

document.getElementsByClassName("inst-button")[0].addEventListener('click', () => {
  const ownable = issueOwnable();
  let color = extractAttributeValue(ownable.attributes, "color");
  let amount_str = extractAttributeValue(ownable.attributes, "capacity");
  initializePotionHTML(msg.ownable_id, parseInt(amount_str), color);
});
document.getElementsByClassName("import-button")[0].addEventListener('click', () => importAssets());

setTimeout(() => syncDb(initializePotionHTML), 0);

window.addEventListener("message", async event => {
  console.log(event);

  if (typeof event.data.ownable_id === "undefined") return;

  if (document.getElementById(event.data.ownable_id).contentWindow !== event.source) {
    //throw Error("Not allowed to execute msg on other ownable");
  }

  await executeOwnable(event.data.ownable_id, event.data.msg);
});
