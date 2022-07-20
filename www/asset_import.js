import {ASSETS_STORE} from "./event-chain";
import JSZip from "jszip";


export function importAssets() {
  let input = document.createElement("input");
  input.type = "file";
  input.name = "file"
  input.id = "file"
  input.multiple = true;
  input.click();

  let templates = [];

  input.onchange = async e => {
    const files = e.target.files;
    let unzippedFiles = await importZip(files);

    for (let i = 0; i < unzippedFiles.length; i++) {
      console.log(unzippedFiles[i]);
      templates[i] = unzippedFiles[i];
    }
    storeTemplates(templates);
  }
  input.onerror = () => console.log("error uploading files");
}

const extToMimes = {
  '.img': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg',
  '.html': 'text/html'
}

async function importZip(f) {
  let files = [];

  await JSZip.loadAsync(f[0])
    .then(async function (zip) {
      for (let [filename, file] of Object.entries(zip.files)) {
        // TODO: find a nicer solution to avoid os-specific files
        if (!filename.includes("MAC")) {
          const blob = await zip.files[filename].async("blob");
          const ext = filename.substring(filename.indexOf('.'));
          console.log(filename, ":", file);
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
  const request = window.indexedDB.open(ASSETS_STORE);
  let db;

  request.onblocked = (event) => console.log("idb blocked: ", event);
  request.onerror = (event) => console.log("failed to open indexeddb: ", event.errorCode);
  request.onupgradeneeded = () => {
    db = request.result;
    if (!db.objectStoreNames.contains(ASSETS_STORE)) {
      db.createObjectStore(ASSETS_STORE);
    }
  };
  request.onsuccess = async () => {
    db = request.result;
    for (let i = 0; i < templates.length; i++) {
      console.log("writing: ", templates[i]);
      if (templates[i].type === extToMimes[".html"]) {
        writeTemplate(db, templates[i]);
      } else {
        writeTemplate(db, templates[i]);
      }
    }
    db.close();
  }
}

function writeTemplate(db, template) {
  return new Promise((resolve, reject) => {
    let tx = db.transaction(ASSETS_STORE, "readwrite")
      .objectStore(ASSETS_STORE)
      .put(template, template["name"]);

    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = (err) => reject(err);
    tx.onblocked = (err) => reject(err);
  });
}

export function fetchTemplate(db, key) {
  return new Promise((resolve, reject) => {
    let tx = db.transaction(ASSETS_STORE, "readonly")
      .objectStore(ASSETS_STORE)
      .get(key);

    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = (err) => reject(err);
    tx.onblocked = (err) => reject(err);
  });
}

