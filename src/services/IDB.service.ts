import TypedDict from "../interfaces/TypedDict";

// Default base DB name; per-address DBs will suffix this with the address
const DEFAULT_DB_NAME = "ownables";

export default class IDBService {
  constructor(
    private db: IDBDatabase,
    private readonly dbName: string,
  ) {}

  static async open(suffix: string): Promise<IDBService> {
    const suffixClean = (suffix || "").trim().toLowerCase();
    const dbName = suffixClean ? `${DEFAULT_DB_NAME}:${suffixClean}` : DEFAULT_DB_NAME;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject((e.target as IDBTransaction).error);
    });

    return new IDBService(db, dbName);
  }

  // Close the DB connection for this instance
  async close(): Promise<void> {
    this.db.close();
  }

  private error(event: Event): Error {
    return (event.target as IDBRequest)?.error || new Error("Unknown error");
  }


  async get(store: string, key: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readonly");
      const request = tx.objectStore(store).get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(this.error(event));
    });
  }

  async getAll(store: string): Promise<Array<any>> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readonly");
      const request = tx.objectStore(store).getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(this.error(event));
    });
  }

  async getMap(store: string): Promise<Map<any, any>> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readonly");
      const request = tx.objectStore(store).openCursor();
      const map = new Map();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          map.set(cursor.primaryKey, cursor.value);
          cursor.continue();
        } else {
          resolve(map);
        }
      };
      request.onerror = (event) => reject(this.error(event));
    });
  }

  async keys(store: string): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db
        .transaction(store, "readonly")
        .objectStore(store)
        .getAllKeys();

      tx.onsuccess = () => resolve(tx.result as string[]);
      tx.onerror = (event) => reject(this.error(event));
    });
  }

  async set(store: string, key: string, value: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readwrite");
      const request = tx.objectStore(store).put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }

  async setAll(
    store: string,
    map: TypedDict | Map<any, any>
  ): Promise<void>;
  async setAll(
    data: TypedDict<TypedDict | Map<any, any>>
  ): Promise<void>;
  async setAll(a: any, b?: any): Promise<void> {
    const storeNames: string | string[] = b ? [a] : Object.keys(a);
    const data: { [_: string]: TypedDict | Map<any, any> } = b ? { [a]: b } : a;

    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(storeNames, "readwrite");

      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(this.error(event));
      tx.onabort = () => reject(new Error("Transaction aborted"));

      try {
        for (const [store, map] of Object.entries(data)) {
          const objectStore = tx.objectStore(store);
          const entries =
            map instanceof Map ? map.entries() : Object.entries(map);

          for (const [key, value] of entries) {
            objectStore.put(value, key);
          }
        }
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  }

  async clear(store: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readwrite");
      const request = tx.objectStore(store).clear();

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }

  private async upgrade(action: (db: IDBDatabase) => void): Promise<void> {
    const version = this.db.version; // Get version before closing DB
    this.db.close();

    this.db = await new Promise(async (resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, version + 1);

      request.onupgradeneeded = () => action(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });
  }

  async listStores(): Promise<string[]> {
    return Array.from(this.db.objectStoreNames);
  }

  async hasStore(store: string): Promise<boolean> {
    return this.db.objectStoreNames.contains(store);
  }

  async createStore(...stores: string[]): Promise<void> {
    await this.upgrade((db) => {
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    });

    // Verify
    for (const store of stores) {
      if (!this.db.objectStoreNames.contains(store)) {
        throw new Error(`Failed to create store ${store}.`);
      }
    }
  }

  async deleteStore(store: string | RegExp): Promise<void> {
    const stores =
      store instanceof RegExp
        ? Array.from(this.db.objectStoreNames).filter((name) => name.match(store))
        : this.db.objectStoreNames.contains(store) ? [store] : [];

    if (stores.length === 0) return;

    await this.upgrade((db2) => {
      for (const s of stores) {
        db2.deleteObjectStore(s);
      }
    });
  }

  async deleteDatabase(): Promise<void> {
    await this.close();

    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(this.dbName);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }

  async delete(store: string, key: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const tx = this.db.transaction(store, "readwrite");
      const request = tx.objectStore(store).delete(key);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }
}
