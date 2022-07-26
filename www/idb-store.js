export class IdbStore {

  constructor(id, STATE_STORE) {
    this.ownable_id = id;
    this.STATE_STORE = STATE_STORE;
  }

  get ownable_id() {
    return this._ownable_id;
  }

  set ownable_id(new_id) {
    this._ownable_id = new_id;
  }

  async get(key) {
    return new Promise(async (resolve, reject) => {
      let db = await this.get_db();

      let tx = db.transaction(this.STATE_STORE, "readonly")
        .objectStore(this.STATE_STORE)
        .get(key);

      tx.onsuccess = () => {
        resolve(tx.result);
      }
      tx.onerror = (err) => reject(err);
    });
  }

  async get_all_idb_keys() {
    return new Promise(async (resolve, reject) => {
      let db = await this.get_db();
      let tx = db.transaction(this.STATE_STORE, "readonly")
        .objectStore(this.STATE_STORE)
        .getAllKeys();

      tx.onsuccess = () => {
        console.log(tx);
        resolve(tx.result);
      }
      tx.onerror = (err) => reject(err);
    });
  }

  async get_db() {
    return new Promise((resolve, reject) => {
      let request = window.indexedDB.open(this.ownable_id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });
  }

  async put(k, v) {
    return new Promise(async (resolve, reject) => {
      let db = await this.get_db();
      let tx = db.transaction(this.STATE_STORE, "readwrite")
        .objectStore(this.STATE_STORE)
        .put(v, k);

      tx.onsuccess = () => resolve(v);
      tx.onerror = (err) => reject(err);
    });
  }

  async clear() {
    let tx = this.db.transaction(this.STATE_STORE, "readwrite")
      .objectStore(this.STATE_STORE)
      .clear();

    tx.onsuccess = () => console.log("store cleared");
    tx.onerror = (err) => console.log(err);
  }

  async init_state_object_store() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.ownable_id);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.STATE_STORE)) {
          request.result.createObjectStore(this.STATE_STORE);
        }
      }
      request.onsuccess = () => {
        resolve(request.result);
      }
      request.onerror = (event) => reject('failed to open indexeddb: ' + event.errorCode);
    });
  }
}
