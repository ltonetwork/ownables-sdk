import TypedDict from "../interfaces/TypedDict";

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

  static async getAll(store: string): Promise<Array<any>> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readonly")
        .objectStore(store)
        .getAll();

      tx.onsuccess = () => resolve(tx.result);
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

  static async setAll(store: string, map: TypedDict<any>): Promise<void>;
  static async setAll(data: TypedDict<TypedDict<any>>): Promise<void>;
  static async setAll(a: any, b?: any): Promise<void> {
    const store: string | string[] = b ? a : Object.keys(a);
    const data: {[_: string]: {[_: string]: any}} = b ? Object.fromEntries([[a, b]]) : a;

    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readwrite");

      for (const [store, map] of Object.entries(data)) {
        const objectStore = tx.objectStore(store);
        for (const [key, value] of Object.entries(map)) {
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


  private static async upgrade(action: (db: IDBDatabase) => void, version: number): Promise<IDBDatabase> {
    return new Promise(async (resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, version);

      request.onupgradeneeded = () => action(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });
  }

  static async create(...stores: string[]): Promise<void> {
    const version = this.db.version; // Get version before closing DB
    this.db.close();

    try {
      this._db = await this.upgrade((db: IDBDatabase) => {
        for (const store of stores) {
          if (db.objectStoreNames.contains(store)) {
            db.deleteObjectStore(store);
          }
          db.createObjectStore(store);
        }
      }, version + 1);
    } catch (e) {
      await this.open();
      throw e;
    }
  }

  public static async delete(store: string|RegExp) {
    const action = store instanceof RegExp
      ? (db: IDBDatabase) => {
        Array.from(db.objectStoreNames)
          .filter(name => name.match(store))
          .forEach(name => db.deleteObjectStore(name));
      }
      : (db: IDBDatabase) => {
        db.deleteObjectStore(store);
      }

    const version = this.db.version; // Get version before closing DB
    this.db.close();

    try {
      this._db = await this.upgrade(action, version + 1);
    } catch (e) {
      await this.open();
      throw e;
    }
  }

  static exists(store: string): boolean {
    return this.db.objectStoreNames.contains(store);
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
