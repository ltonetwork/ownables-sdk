import {
  executeOwnable,
  initializeOwnableHTML,
  issueOwnable,
  syncDb,
} from "./wasm-wrappers";
import {addOwnableOption, fetchTemplate, importAssets} from "./asset_import";
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
  INFO: "info",
};

export function updateState(ownable_id, state) {
  const iframe = document.getElementById(ownable_id);
  iframe.contentWindow.postMessage({ownable_id, state}, "*");
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

function extractAttributeValue(attributes, key) {
  return attributes.filter(prop => {
    return prop.key === key
  })[0].value;
}

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

export async function instantiateOwnable(templateName) {
  return new Promise(async (resolve, reject) => {
    document.getElementById("inst-menu").classList.toggle("show");
    const ownable = await issueOwnable(templateName);
    // TODO: generalize for all ownable types
    if (templateName === "potion") {
      let color_hex = extractAttributeValue(ownable.attributes, "color");
      let current_amount = extractAttributeValue(ownable.attributes, "capacity");
      let state = {
        color_hex,
        current_amount,
      };
      await initializeOwnableHTML(ownable.ownable_id, state);
      resolve();
    } else if (templateName) {
      await initializeOwnableHTML(ownable.ownable_id, {});
      resolve();
    } else {
      console.log("Unknown template: ", templateName);
      reject();
    }
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
    case eventType.EXECUTE:
      await executeOwnable(event.data.ownable_id, event.data.msg);
      break;
    default:
      console.log("unknown msg");
      break;
  }
});

