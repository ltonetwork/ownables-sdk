import TypedDict from "../interfaces/TypedDict";

const DB_NAME = 'ownables';

export default class IDBService {
  private static _db?: IDBDatabase;

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
      request.onerror = (e) => reject((e.target as IDBTransaction).error);
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

  static async getAll(store: string): Promise<Map<any, any>> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readonly")
        .objectStore(store)
        .openCursor();

      const map = new Map();

      tx.onsuccess = () => {
        let cursor = tx.result;
        if (cursor) {
          map.set(cursor.primaryKey, cursor.value);
          cursor.continue();
        } else {
          return resolve(map);
        }
      };
      tx.onerror = (e) => reject(e);
    });
  }

  static async has(store: string, key: string): Promise<boolean> {
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

  static async setAll(store: string, map: TypedDict<any>|Map<any, any>): Promise<void>;
  static async setAll(data: TypedDict<TypedDict<any>|Map<any, any>>): Promise<void>;
  static async setAll(a: any, b?: any): Promise<void> {
    const storeNames: string | string[] = b ? a : Object.keys(a);
    const data: {[_: string]: TypedDict<any>|Map<any, any>} = b ? Object.fromEntries([[a, b]]) : a;

    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(storeNames, "readwrite");

      for (const [store, map] of Object.entries(data)) {
        const objectStore = tx.objectStore(store);
        for (const [key, value] of (map instanceof Map ? map.entries() : Object.entries(map))) {
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


  private static async upgrade(action: (db: IDBDatabase) => void): Promise<void> {
    const version = this.db.version; // Get version before closing DB
    this.db.close();
    delete this._db;

    try {
      this._db = await new Promise(async (resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, version + 1);

        request.onupgradeneeded = () => action(request.result);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
      });
    } catch (e) {
      await this.open();
      throw e;
    }
  }

  static list(): string[] {
    return Array.from(this.db.objectStoreNames);
  }

  static exists(store: string): boolean {
    return this.db.objectStoreNames.contains(store);
  }

  static async create(...stores: string[]): Promise<void> {
    await this.upgrade(db => {
      for (const store of stores) {
        db.createObjectStore(store);
      }
    });
  }

  static async createForced(...stores: string[]): Promise<void> {
    await this.upgrade(db => {
      for (const store of stores) {
        if (db.objectStoreNames.contains(store)) {
          db.deleteObjectStore(store);
        }
        db.createObjectStore(store);
      }
    });
  }

  public static async delete(store: string|RegExp): Promise<void> {
    const stores = store instanceof RegExp
      ? Array.from(this.db.objectStoreNames).filter(name => name.match(store))
      : (this.db.objectStoreNames.contains(store) ? store : []);

    if (stores.length === 0) return;

    await this.upgrade(db => {
      for (const store of stores) {
        db.deleteObjectStore(store);
      }
    });
  }

  static async destroy(): Promise<void> {
    this.db.close();

    try {
      await new Promise<void>((resolve, reject) => {
        const request = window.indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject((e.target as IDBTransaction).error);
      });
    } finally {
      await this.open();
    }
  }
}
