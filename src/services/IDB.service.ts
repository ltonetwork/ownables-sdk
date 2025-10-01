import TypedDict from "../interfaces/TypedDict";

// Default base DB name; per-address DBs will suffix this with the address
const DEFAULT_DB_NAME = "ownables";

export default class IDBService {
  // Instance members
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly dbName: string;

  // Optional singleton to keep backward compatibility for existing static calls
  private static defaultInstance: IDBService | null = null;

  constructor(suffix?: string) {
    const suffixClean = (suffix || "").trim().toLowerCase();
    this.dbName = suffixClean ? `${DEFAULT_DB_NAME}:${suffixClean}` : DEFAULT_DB_NAME;
  }

  // Open the DB connection for this instance
  async open(): Promise<void> {
    if (this.dbPromise) return;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject((e.target as IDBTransaction).error);
    });

    await this.dbPromise;
  }

  // Close the DB connection for this instance
  async close(): Promise<void> {
    if (!this.dbPromise) return;
    try {
      (await this.dbPromise).close();
    } finally {
      this.dbPromise = null;
    }
  }

  private error(event: Event): Error {
    return (event.target as IDBRequest)?.error || new Error("Unknown error");
  }

  private async requireOpen(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      await this.open();
    }
    return this.dbPromise as Promise<IDBDatabase>;
  }

  async get(store: string, key: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const db = await this.requireOpen();
      const tx = (await db).transaction(store, "readonly");
      const request = tx.objectStore(store).get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(this.error(event));
    });
  }

  async getAll(store: string): Promise<Array<any>> {
    return new Promise(async (resolve, reject) => {
      const db = await this.requireOpen();
      const tx = (await db).transaction(store, "readonly");
      const request = tx.objectStore(store).getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(this.error(event));
    });
  }

  async getMap(store: string): Promise<Map<any, any>> {
    return new Promise(async (resolve, reject) => {
      const db = await this.requireOpen();
      const tx = (await db).transaction(store, "readonly");
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
      const db = await this.requireOpen();
      const tx = (await db)
        .transaction(store, "readonly")
        .objectStore(store)
        .getAllKeys();

      tx.onsuccess = () => resolve(tx.result as string[]);
      tx.onerror = (event) => reject(this.error(event));
    });
  }

  async set(store: string, key: string, value: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = await this.requireOpen();
      const tx = (await db).transaction(store, "readwrite");
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
      const db = await this.requireOpen();
      const tx = (await db).transaction(storeNames, "readwrite");

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
      const db = await this.requireOpen();
      const tx = (await db).transaction(store, "readwrite");
      const request = tx.objectStore(store).clear();

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }

  private async upgrade(action: (db: IDBDatabase) => void): Promise<void> {
    const db = await this.requireOpen();
    const version = (await db).version; // Get version before closing DB
    (await db).close();

    this.dbPromise = new Promise(async (resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, version + 1);

      request.onupgradeneeded = () => action(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });

    try {
      await this.dbPromise;
    } catch (e) {
      await this.open();
      throw e;
    }
  }

  async listStores(): Promise<string[]> {
    return Array.from((await this.requireOpen()).objectStoreNames);
  }

  async hasStore(store: string): Promise<boolean> {
    return (await this.requireOpen()).objectStoreNames.contains(store);
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
    const db = await this.requireOpen();
    for (const store of stores) {
      if (!db.objectStoreNames.contains(store)) {
        throw new Error(`Failed to create store ${store}.`);
      }
    }
  }

  async deleteStore(store: string | RegExp): Promise<void> {
    const db = await this.requireOpen();
    const stores =
      store instanceof RegExp
        ? Array.from(db.objectStoreNames).filter((name) => name.match(store))
        : db.objectStoreNames.contains(store)
        ? [store]
        : [];

    if (stores.length === 0) return;

    await this.upgrade((db2) => {
      for (const s of stores) {
        db2.deleteObjectStore(s);
      }
    });
  }

  async deleteDatabase(): Promise<void> {
    const db = await this.requireOpen();
    (await db).close();
    this.dbPromise = Promise.reject("Database deleted. Reload application.");

    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(this.dbName);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }

  async delete(store: string, key: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = await this.requireOpen();
      const tx = (await db).transaction(store, "readwrite");
      const request = tx.objectStore(store).delete(key);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }

  // ---- Static proxy API (backward compatibility) ----
  static getDefault(): IDBService {
    if (!this.defaultInstance) this.defaultInstance = new IDBService();
    return this.defaultInstance;
  }

  static setDefault(instance: IDBService): void {
    this.defaultInstance = instance;
  }

  static async open(): Promise<void> {
    return this.getDefault().open();
  }

  static async close(): Promise<void> {
    return this.getDefault().close();
  }

  static async get(store: string, key: string): Promise<any> {
    return this.getDefault().get(store, key);
  }

  static async getAll(store: string): Promise<Array<any>> {
    return this.getDefault().getAll(store);
  }

  static async getMap(store: string): Promise<Map<any, any>> {
    return this.getDefault().getMap(store);
  }

  static async keys(store: string): Promise<string[]> {
    return this.getDefault().keys(store);
  }

  static async set(store: string, key: string, value: any): Promise<void> {
    return this.getDefault().set(store, key, value);
  }

  static async setAll(a: any, b?: any): Promise<void> {
    // Overload preserved
    // @ts-ignore
    return this.getDefault().setAll(a, b);
  }

  static async clear(store: string): Promise<void> {
    return this.getDefault().clear(store);
  }

  static async listStores(): Promise<string[]> {
    return this.getDefault().listStores();
  }

  static async hasStore(store: string): Promise<boolean> {
    return this.getDefault().hasStore(store);
  }

  static async createStore(...stores: string[]): Promise<void> {
    return this.getDefault().createStore(...stores);
  }

  static async deleteStore(store: string | RegExp): Promise<void> {
    return this.getDefault().deleteStore(store);
  }

  static async deleteDatabase(): Promise<void> {
    return this.getDefault().deleteDatabase();
  }

  static async delete(store: string, key: string): Promise<void> {
    return this.getDefault().delete(store, key);
  }
}
