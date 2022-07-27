export class IdbStore {

  constructor(id) {
    this.ownable_id = id;
    this.STATE_STORE = "state";
    this.DB_OP = {
      R: "readonly",
      RW: "readwrite"
    };
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

      let tx = db.transaction(this.STATE_STORE, this.DB_OP.R)
        .objectStore(this.STATE_STORE)
        .get(key);

      tx.onsuccess = () => resolve(tx.result);
      tx.onerror = (e) => reject(e);
    });
  }

  async get_all_idb_keys() {
    return new Promise(async (resolve, reject) => {
      let db = await this.get_db();
      let tx = db.transaction(this.STATE_STORE, this.DB_OP.R)
        .objectStore(this.STATE_STORE)
        .getAllKeys();

      tx.onsuccess = () => resolve(tx.result);
      tx.onerror = (e) => reject(e);
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
      let tx = db.transaction(this.STATE_STORE, this.DB_OP.RW)
        .objectStore(this.STATE_STORE)
        .put(v, k);

      tx.onsuccess = () => resolve(v);
      tx.onerror = (e) => reject(e);
    });
  }

  async clear() {
    return new Promise(async (resolve, reject) => {
      let tx = this.db.transaction(this.STATE_STORE, this.DB_OP.RW)
        .objectStore(this.STATE_STORE)
        .clear();

      tx.onsuccess = () => resolve("store cleared");
      tx.onerror = (e) => reject(e);
    });
  }

  async init_state_object_store() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.ownable_id);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.STATE_STORE)) {
          request.result.createObjectStore(this.STATE_STORE);
        }
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject('failed to open indexeddb: ' + e.errorCode);
    });
  }
}
