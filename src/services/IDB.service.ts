import TypedDict from "../interfaces/TypedDict";

const DB_NAME = "ownables";

export default class IDBService {
  private static db: Promise<IDBDatabase>;

  static async open(): Promise<void> {
    this.db = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject((e.target as IDBTransaction).error);
    });

    await this.db;
  }

  private static error(event: Event): Error {
    return (event.target as IDBRequest)?.error || new Error("Unknown error");
  }

  static async get(store: string, key: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const db = await this.db;
      const tx = db.transaction(store, "readonly");
      const request = tx.objectStore(store).get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(this.error(event));
    });
  }

  static async getAll(store: string): Promise<Array<any>> {
    return new Promise(async (resolve, reject) => {
      const db = await this.db;
      const tx = db.transaction(store, "readonly");
      const request = tx.objectStore(store).getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(this.error(event));
    });
  }

  static async getMap(store: string): Promise<Map<any, any>> {
    return new Promise(async (resolve, reject) => {
      const db = await this.db;
      const tx = db.transaction(store, "readonly");
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

  static async keys(store: string): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
      const tx = (await this.db)
        .transaction(store, "readonly")
        .objectStore(store)
        .getAllKeys();

      tx.onsuccess = () => resolve(tx.result as string[]);
      tx.onerror = (event) => reject(this.error(event));
    });
  }

  static async set(store: string, key: string, value: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = await this.db;
      const tx = db.transaction(store, "readwrite");
      const request = tx.objectStore(store).put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }

  static async setAll(
    store: string,
    map: TypedDict | Map<any, any>
  ): Promise<void>;
  static async setAll(
    data: TypedDict<TypedDict | Map<any, any>>
  ): Promise<void>;
  static async setAll(a: any, b?: any): Promise<void> {
    const storeNames: string | string[] = b ? a : Object.keys(a);
    const data: { [_: string]: TypedDict | Map<any, any> } = b
      ? Object.fromEntries([[a, b]])
      : a;

    return new Promise(async (resolve, reject) => {
      const db = await this.db;
      const tx = db.transaction(storeNames, "readwrite");
      const requests: IDBRequest[] = [];

      for (const [store, map] of Object.entries(data)) {
        const objectStore = tx.objectStore(store);
        for (const [key, value] of map instanceof Map
          ? map.entries()
          : Object.entries(map)) {
          requests.push(objectStore.put(value, key));
        }
      }

      // Wait for all requests to complete
      Promise.all(
        requests.map(
          (request) =>
            new Promise<void>((resolve, reject) => {
              request.onsuccess = () => resolve();
              request.onerror = (event) => reject(this.error(event));
            })
        )
      )
        .then(() => resolve())
        .catch(reject);
    });
  }

  static async clear(store: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = await this.db;
      const tx = db.transaction(store, "readwrite");
      const request = tx.objectStore(store).clear();

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }

  private static async upgrade(
    action: (db: IDBDatabase) => void
  ): Promise<void> {
    const version = (await this.db).version; // Get version before closing DB
    (await this.db).close();

    this.db = new Promise(async (resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, version + 1);

      request.onupgradeneeded = () => action(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });

    try {
      await this.db;
    } catch (e) {
      await this.open();
      throw e;
    }
  }

  static async listStores(): Promise<string[]> {
    return Array.from((await this.db).objectStoreNames);
  }

  static async hasStore(store: string): Promise<boolean> {
    return (await this.db).objectStoreNames.contains(store);
  }

  // static async createStore(...stores: string[]): Promise<void> {
  //   await this.upgrade((db) => {
  //     for (const store of stores) {
  //       db.createObjectStore(store);
  //     }
  //   });
  // }

  static async createStore(...stores: string[]): Promise<void> {
    await this.upgrade((db) => {
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    });

    // Check that the store(s) now exist
    const db = await this.db;
    for (const store of stores) {
      if (!db.objectStoreNames.contains(store)) {
        throw new Error(`Failed to create store ${store}.`);
      }
    }
  }

  public static async deleteStore(store: string | RegExp): Promise<void> {
    const stores =
      store instanceof RegExp
        ? Array.from((await this.db).objectStoreNames).filter((name) =>
            name.match(store)
          )
        : (await this.db).objectStoreNames.contains(store)
        ? [store]
        : [];

    if (stores.length === 0) return;

    await this.upgrade((db) => {
      for (const store of stores) {
        db.deleteObjectStore(store);
      }
    });
  }

  static async deleteDatabase(): Promise<void> {
    (await this.db).close();
    this.db = Promise.reject("Database deleted. Reload application.");

    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }

  static async delete(store: string, key: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = await this.db;
      const tx = db.transaction(store, "readwrite");
      const request = tx.objectStore(store).delete(key);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(this.error(event));
    });
  }
}
