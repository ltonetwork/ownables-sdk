import {ASSETS_STORE} from "./event-chain";
import JSZip from "jszip";
import {instantiateOwnable} from "./index";
import {initWasmTemplate} from "./wasm-wrappers";


export function importAssets() {
  let input = document.createElement("input");
  input.type = "file";
  input.name = "file";
  input.id = "file";
  input.accept = ".zip";
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
  '.mp4': 'video/mp4',
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
    // TODO: get ownable name from elsewhere
    let templateFile = templates.find(t => t.type === extToMimes[".html"]);
    let templateName = dropFilenameExtension(templateFile.name);

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
        for (let i = 0; i < templates.length; i++) {
          await writeTemplate(db, templateName, templates[i]);
        }
        const templateOptions = JSON.parse(localStorage.templates);
        templateOptions.push(templateName);
        localStorage.templates = JSON.stringify(templateOptions);
        await addOwnableOption(templateName);
      } else {
        console.log('existing template import');
      }
      console.log("templates stored");
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
    console.log(`instantiating ${templateName}`);
    await instantiateOwnable(templateName);
  });
  document.getElementById("inst-menu").appendChild(ownableHtml);
}

function writeTemplate(db, ownableType, template) {
  return new Promise(async (resolve, reject) => {
    let templateName;
    switch (template.type) {
      case "application/wasm":
        templateName = "wasm";
        break;
      case "text/html":
        templateName = "html";
        break;
      case "text/javascript":
        templateName = "bindgen.js";
        break;
      default:
        templateName = template["name"];
        break;
    }
    let tx = db
      .transaction(ownableType, "readwrite")
      .objectStore(ownableType)
      .put(template, templateName);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = (err) => reject(err);
    tx.onblocked = (err) => reject(err);
  });
}



function appendWorkerGlueCode(templateName) {
  return new Promise((resolve, reject) => {
    let db, template;
    const request = window.indexedDB.open(ASSETS_STORE);
    request.onsuccess = async () => {
      db = request.result;
      let templateTx = db.transaction(templateName, "readonly")
        .objectStore(templateName)
        .get("bindgen.js");
      templateTx.onsuccess = () => {
        template = templateTx.result;
        const fr = new FileReader();
        fr.onload = async () => {
          let bindgenDataURL = fr.result;
          let workerDataURL = await readWorkerGlueAsDataURL();
          // append the worker glue code to bindgen glue code
          let combinedDataURL = joinDataURLContents(bindgenDataURL, workerDataURL);
          console.log(combinedDataURL);
          let newTemplate = new File([combinedDataURL], template.name, { type: template.type });
          let updateTemplateTx = db.transaction(templateName, "readwrite")
            .objectStore(templateName)
            .put(newTemplate, "bindgen.js");
          updateTemplateTx.onsuccess = () => {
            resolve(updateTemplateTx.result);
          };
        };
        if (template) {
          console.log("reading template data url");
          fr.readAsDataURL(template);
        } else {
          reject();
        }
      }
    }
  });
}


function readWorkerGlueAsDataURL() {
  return new Promise(async (resolve, reject) => {
    let fr = new FileReader();
    fr.onload = async (event) => {
      resolve(fr.result);
    };
    let glueFile = await fetch("worker.js");
    fr.readAsDataURL(await glueFile.blob());
  });
}

function joinDataURLContents(first, second) {
  const dataURLPrefix = 'data:text/javascript;base64,';
  let firstSplit = first.split('base64,');
  let secondSplit = second.split('base64,');
  let joinedContents = atob(firstSplit[1]) + atob(secondSplit[1]);
  let joinedB64 = btoa(joinedContents);
  return dataURLPrefix + joinedB64;
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
