var xhr = new XMLHttpRequest(), blob;

export function importAssets() {
  let input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.click();

  let templates = [];

  input.onchange = e => {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
      templates[i] = files[i];
    }
    storeTemplates(templates);
  }
  input.onerror = () => console.log("error uploading files");
}

function storeTemplates(templates) {
  const request = window.indexedDB.open("assets");
  let db;

  request.onblocked = (event) => console.log("idb blocked: ", event);
  request.onerror = (event) => console.log("failed to open indexeddb: ", event.errorCode);
  request.onupgradeneeded = () => {
    db = request.result;
    if (!db.objectStoreNames.contains("img")) {
      db.createObjectStore("img");
    }
  };
  request.onsuccess = async () => {
    db = request.result;
    for (let i = 0; i < templates.length; i++) {
      await writeImg(db, templates[i]);
    }
  }
}

function writeImg(db, template) {
  return new Promise((resolve, reject) => {
    let tx = db.transaction("img", "readwrite")
      .objectStore("img")
      .put(template, template["name"]);

    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = (err) => reject(err);
    tx.onblocked = (err) => reject(err);
  });
}
