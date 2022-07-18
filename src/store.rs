use cosmwasm_std::{MemoryStorage, Order, Record, Storage};
use indexed_db_futures::prelude::*;
use js_sys::{Array, Uint8Array};
use wasm_bindgen::{JsValue, UnwrapThrowExt};

pub struct IdbStorage {
    db: IdbDatabase,
    storage: MemoryStorage,
}

const INDEXDB_STORE: &str = "state";

impl IdbStorage {
    pub async fn new(mut name: &str) -> Self {
        if name.is_empty() {
            name = "ownable_db"
        }
        let db = Self::create_db(name);
        let mem_storage = MemoryStorage::new();

        return IdbStorage {
            db: db.await,
            storage: mem_storage,
        };
    }

    pub async fn load(name: &str) -> Self {
        let db = Self::create_db(name).await;

        let mut store = IdbStorage {
            db,
            storage: MemoryStorage::new(),
        };

        store.load_to_mem_storage().await;
        store
    }

    pub fn close(&self) {
        self.db.close()
    }
}

impl Storage for IdbStorage {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        self.storage.get(key)
    }

    fn range<'a>(
        &'a self,
        start: Option<&[u8]>,
        end: Option<&[u8]>,
        order: Order,
    ) -> Box<dyn Iterator<Item = Record> + 'a> {
        self.storage.range(start, end, order)
    }

    fn set(&mut self, key: &[u8], value: &[u8]) {
        self.storage.set(key, value)
    }

    fn remove(&mut self, key: &[u8]) {
        self.storage.remove(key)
    }
}

impl IdbStorage {
    pub async fn create_db(name: &str) -> IdbDatabase {
        // expect a db with some db initialized from js side (v1)
        let mut db_req: OpenDbRequest = IdbDatabase::open_u32(name, 2).unwrap();

        db_req.set_on_upgrade_needed(Some(|evt: &IdbVersionChangeEvent| -> Result<(), JsValue> {
            let db = evt.db();
            // Check if the object store exists; create it if it doesn't
            #[allow(clippy::redundant_pattern_matching)]
            if let None = db.object_store_names().find(|n| n == INDEXDB_STORE) {
                db.create_object_store(INDEXDB_STORE).unwrap();
            }
            Ok(())
        }));

        let async_res = db_req.into_future().await;
        async_res.unwrap()
    }

    pub fn clear_store(&mut self, store_name: &str) {
        let tx = self
            .db
            .transaction_on_one_with_mode(store_name, IdbTransactionMode::Readwrite)
            .unwrap_throw();
        let store = tx.object_store(store_name).unwrap_throw();

        store.clear().unwrap();
    }

    pub async fn set_item(&self, key: &[u8], value: &[u8]) {
        let tx = self
            .db
            .transaction_on_one_with_mode(INDEXDB_STORE, IdbTransactionMode::Readwrite)
            .unwrap_throw();
        let store = tx.object_store(INDEXDB_STORE).unwrap_throw();

        store
            .put_key_val_owned(Uint8Array::from(key), &Uint8Array::from(value))
            .unwrap_throw();

        let _ = tx.await.into_result().unwrap_throw();
    }

    pub async fn get_item(&self, key: &[u8]) -> Vec<u8> {
        let tx = self.db.transaction_on_one(INDEXDB_STORE).unwrap();
        let store = tx.object_store(INDEXDB_STORE).unwrap();
        let async_res = store.get_owned(Uint8Array::from(key)).unwrap();
        // let res = async_res.unwrap();
        let res = async_res.await.unwrap().unwrap();
        Uint8Array::new(&res).to_vec()
    }

    pub async fn load_key_to_mem_storage(&mut self, key: &[u8]) {
        let data = self.get_item(key).await;
        self.storage.set(key, &data);
    }

    pub async fn load_key_from_mem_storage(&mut self, key: &[u8]) {
        let data = self.get(key).unwrap();
        self.set_item(key, &data).await;
    }

    pub async fn load_to_mem_storage(&mut self) {
        let store_name = INDEXDB_STORE;

        let tx = self
            .db
            .transaction_on_one_with_mode(store_name, IdbTransactionMode::Readonly)
            .unwrap();
        let store = tx.object_store(store_name).unwrap_throw();

        let data = store.get_all_keys().unwrap_throw();
        let arraydata: Array = data.await.unwrap();
        // JsCast::unchecked_from_js(data.unwrap());
        // let array_data = data.new();

        if arraydata.to_vec().is_empty() {
            return;
        }
        for js_k in arraydata.iter() {
            let k = Uint8Array::new(&js_k).to_vec();

            let v = self.get_item(&k).await;

            self.storage.set(&k, &v);
        }
    }

    pub async fn sync_to_db(&self) {
        // "start" and "end" being "None" leads to checking the whole storage range
        for (key, value) in self.storage.range(None, None, Order::Ascending) {
            // overwrites values for keys iff present
            self.set_item(&key, &value).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_and_set() {
        let mut store = MemoryStorage::new();
        assert_eq!(store.get(b"foo"), None);
        store.set(b"foo", b"bar");
        assert_eq!(store.get(b"foo"), Some(b"bar".to_vec()));
        assert_eq!(store.get(b"food"), None);
    }

    #[test]
    #[should_panic(
        expected = "Getting empty values from storage is not well supported at the moment."
    )]
    fn set_panics_for_empty() {
        let mut store = MemoryStorage::new();
        store.set(b"foo", b"");
    }

    #[test]
    fn delete() {
        let mut store = MemoryStorage::new();
        store.set(b"foo", b"bar");
        store.set(b"food", b"bank");
        store.remove(b"foo");

        assert_eq!(store.get(b"foo"), None);
        assert_eq!(store.get(b"food"), Some(b"bank".to_vec()));
    }
}
