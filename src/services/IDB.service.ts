const DB_NAME = 'ownables';

export default class IDBService {
  private static _db: IDBDatabase;

  private static get db(): IDBDatabase {
    if (!this._db) throw new Error("Database not opened");
    return this._db;
  }

  static async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME);

      request.onsuccess = () => {
        this._db = request.result;
        resolve();
      }
      request.onerror = (e) => reject(e);
    });
  }

  static async get(store: string, key: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readonly")
        .objectStore(store)
        .get(key);

      tx.onsuccess = () => resolve(tx.result);
      tx.onerror = (e) => reject(e);
    });
  }

  static async keys(store: string): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readonly")
        .objectStore(store)
        .getAllKeys();

      tx.onsuccess = () => resolve(tx.result as string[]);
      tx.onerror = (e) => reject(e);
    });
  }

  static async set(store: string, key: string, value: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readwrite")
        .objectStore(store)
        .put(value, key);

      tx.onsuccess = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }

  static async setAll(data: {[store: string]: {[key: string]: any}}): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(Object.keys(data), "readwrite");

      for (const store in data) {
        const objectStore = tx.objectStore(store);
        for (const [key, value] of Object.entries(data[store])) {
          objectStore.put(value, key);
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }

  static async clear(store: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readwrite")
        .objectStore(store)
        .clear();

      tx.onsuccess = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }
}
