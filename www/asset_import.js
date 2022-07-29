import {ASSETS_STORE} from "./event-chain";
import JSZip from "jszip";
import {instantiateOwnable} from "./index";


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
  let templateFile = templates.find(t => t.type === extToMimes[".html"]);
  let templateName = dropFilenameExtension(templateFile.name);

  request.onblocked = (event) => console.log("idb blocked: ", event);
  request.onerror = (event) => console.log("failed to open indexeddb: ", event.errorCode);
  request.onupgradeneeded = () => {
    db = request.result;
    if (!db.objectStoreNames.contains(templateName)) {
      db.createObjectStore(templateName);
    }
  };
  request.onsuccess = async () => {
    db = request.result;
    const objectStore = db.transaction([templateName], "readwrite")
      .objectStore(templateName);
    for (let i = 0; i < templates.length; i++) {
      await writeTemplate(objectStore, templates[i]);
    }
    const templateOptions = JSON.parse(localStorage.templates);
    templateOptions.push(templateName);
    localStorage.templates = JSON.stringify(templateOptions);
    addOwnableOption(templateName);
    db.close();
  }
}

export function addOwnableOption(templateName) {
  let ownableHtml = document.createElement("button");
  ownableHtml.id = `inst-${templateName}`;
  ownableHtml.innerText = templateName;
  ownableHtml.type = "button";
  ownableHtml.addEventListener('click', async () => {
    await instantiateOwnable();
  });
  document.getElementById("inst-menu").appendChild(ownableHtml);
}

function writeTemplate(objectStore, template) {
  return new Promise((resolve, reject) => {
    let tx = objectStore.put(template, template["name"]);
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

