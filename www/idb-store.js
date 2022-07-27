export class IdbStore {

  constructor(id) {
    this.ownable_id = id;
    this.STATE_STORE = "state";
    this.DB_OP = {
      R: "readonly",
      RW: "readwrite"
    };
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

}
