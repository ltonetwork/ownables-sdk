import {ASSETS_STORE} from "./event-chain";
import JSZip from "jszip";
import {instantiateOwnable} from "./index";
import {initWasmTemplate} from "./wasm-wrappers";


export function importAssets() {
  let input = document.createElement("input");
  input.type = "file";
  input.name = "file"
  input.id = "file"
  input.multiple = true;
  let templates = [];

  input.onchange = async e => {
    const files = e.target.files;
    let unzippedFiles = await importZip(files);
    for (let i = 0; i < unzippedFiles.length; i++) {
      templates[i] = unzippedFiles[i];
    }
    await storeTemplates(templates);
  }
  input.onerror = () => console.log("error uploading files");
  input.click();
}

const extToMimes = {
  '.img': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
}

async function importZip(f) {
  let files = [];

  await JSZip.loadAsync(f[0])
    .then(async function (zip) {
      for (let [filename, file] of Object.entries(zip.files)) {
        if (!filename.includes("MAC")) {
          const blob = await zip.files[filename].async("blob");
          const ext = filename.substring(filename.indexOf('.'));
          files.push(new File([blob], filename, {
            type: extToMimes[ext]
          }));
        }
      }
    }, function (e) {
        console.log("error reading")
    }
  );
  return files;
}

function storeTemplates(templates) {
  return new Promise((resolve, reject) => {
    let templateFile = templates.find(t => t.type === extToMimes[".html"]);
    let templateName = dropFilenameExtension(templateFile.name);
    console.log("importing template: ", templateName);
    let newImport = false;
    let db;
    const templateCount = JSON.parse(localStorage.templates).length;
    const request = window.indexedDB.open(ASSETS_STORE, templateCount + 1);
    request.onupgradeneeded = (e) => {
      db = request.result;
      if (!db.objectStoreNames.contains(templateName)) {
        newImport = true;
        db.createObjectStore(templateName);
      }
    };
    request.onsuccess = async () => {
      db = request.result;
      if (newImport) {
        const objectStore = db.transaction([templateName], "readwrite")
          .objectStore(templateName);
        for (let i = 0; i < templates.length; i++) {
          console.log(templates[i]);
          await writeTemplate(objectStore, templates[i]);
        }
        const templateOptions = JSON.parse(localStorage.templates);
        templateOptions.push(templateName);
        localStorage.templates = JSON.stringify(templateOptions);
        await addOwnableOption(templateName);
      } else {
        console.log('existing template import');
      }
      await initWasmTemplate(templateName);
      db.close();
      resolve();
    }
    request.onblocked = (event) => reject("idb blocked: ", event);
    request.onerror = (event) => reject("failed to open indexeddb: ", event);
  });

}

export async function addOwnableOption(templateName) {
  let ownableHtml = document.createElement("button");
  ownableHtml.id = `inst-${templateName}`;
  ownableHtml.innerText = templateName;
  ownableHtml.type = "button";
  ownableHtml.addEventListener('click', async () => {
    await instantiateOwnable(templateName);
  });
  document.getElementById("inst-menu").appendChild(ownableHtml);
}

function writeTemplate(objectStore, template) {
  return new Promise((resolve, reject) => {
    let templateName;
    switch (template.type) {
      case "application/wasm":
        templateName = "wasm";
        break;
      case "text/html":
        templateName = "html";
        break;
      case "text/javascript":
        console.log(template);
        templateName = "bindgen";
        break;
      default:
        templateName = template["name"];
        break;
    }
    let tx = objectStore.put(template, templateName);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = (err) => reject(err);
    tx.onblocked = (err) => reject(err);
  });
}

export function dropFilenameExtension(filename) {
  return filename.substring(0, filename.indexOf("."));
}

export function fetchTemplate(db, key, objectStore) {
  return new Promise((resolve, reject) => {
    let tx = db.transaction(objectStore, "readonly")
      .objectStore(objectStore)
      .get(key);

    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = (err) => reject(err);
    tx.onblocked = (err) => reject(err);
  });
}

export function associateOwnableType(db, ownableId, ownableType) {
  return new Promise((resolve, reject) => {
    let tx = db.transaction("associations", "readwrite")
      .objectStore("associations")
      .put(ownableType, ownableId);

    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = (err) => reject(err);
    tx.onblocked = (err) => reject(err);
  });
}

export function getOwnableType(ownableId) {
  return new Promise((resolve, reject) => {
    let dbTx = indexedDB.open(ownableId);
    dbTx.onsuccess = (e) => {
      let db = e.target.result;
      let tx = db.transaction("associations", "readwrite")
        .objectStore("associations")
        .get(ownableId);
      tx.onsuccess = () => {
        db.close();
        resolve(tx.result);
      }
      tx.onerror = () => {
        db.close();
        reject();
      }
    }
    dbTx.onblocked = () => reject("db blocked");
    dbTx.onerror = () => reject("failed to open db");
  });
}
