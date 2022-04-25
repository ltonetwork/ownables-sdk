use cosmwasm_std::{Storage, MemoryStorage, Record, Order};
use indexed_db_futures::prelude::*;
// use futures::{executor::block_on};

use wasm_bindgen::JsValue;
use js_sys::Uint8Array;

pub struct IdbStorage {
    db: IdbDatabase,
    storage: MemoryStorage,
}


impl IdbStorage {
    pub async fn new() -> Self {
        let db = Self::create_db("my_db");
        let mem_storage = MemoryStorage::new();

        return IdbStorage {db: db.await, storage: mem_storage};
    }
    
    pub async fn load(name: &str) -> Self {
        let db = Self::create_db(name).await;

        let mem_storage = Self::load_to_mem_storage(&db).await;
        

        return IdbStorage {db, storage: mem_storage};
    }
}

impl Storage for IdbStorage {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        return self.storage.get(key)
    }

    fn range<'a>(
        &'a self,
        start: Option<&[u8]>,
        end: Option<&[u8]>,
        order: Order,
    ) -> Box<dyn Iterator<Item = Record> + 'a> {
        return self.storage.range(start, end, order);
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
        let mut db_req: OpenDbRequest = IdbDatabase::open_u32(name, 1).unwrap();
        db_req.set_on_upgrade_needed(Some(|evt: &IdbVersionChangeEvent| -> Result<(), JsValue> {
            // Check if the object store exists; create it if it doesn't
            if let None = evt.db().object_store_names().find(|n| n == "my_store") {
                evt.db().create_object_store("my_store").unwrap();
            }
            Ok(())
        }));

        let async_res = db_req.into_future().await;
        return async_res.unwrap();
    }

    pub async fn get_item(db: IdbDatabase, key: &[u8]) -> Option<JsValue> {
        let tx = db.transaction_on_one("my_store").unwrap();
        let store = tx.object_store("my_store").unwrap();
        let async_res = store.get_owned(Uint8Array::from(key)).unwrap().await;
        let res = async_res.unwrap();
        return res;
    }


    pub async fn set_item(&self, key: &[u8], value: &[u8]) {
        let tx = self.db.transaction_on_one_with_mode("my_store", IdbTransactionMode::Readwrite).unwrap();
        let store = tx.object_store("my_store").unwrap();

        let _ = store.put_key_val_owned(Uint8Array::from(key) , &Uint8Array::from(value)).unwrap();
    }

    pub async fn load_to_mem_storage(db: &IdbDatabase)-> MemoryStorage {
        let mut mem_storage = MemoryStorage::new();

        match db.create_object_store("my_store").unwrap()
                .open_cursor().unwrap().await.unwrap() {
            Some(cursor) => {


                let first_key  = Uint8Array::new(&cursor.key().unwrap()).to_vec();
                let first_value  = Uint8Array::new(&cursor.value()).to_vec();
                mem_storage.set(&first_key, &first_value);
        
                // Iterate one by one
                while cursor.continue_cursor().unwrap().await.unwrap() {
                    let next_key = Uint8Array::new(&cursor.key().unwrap()).to_vec();
                    let next_value = Uint8Array::new(&cursor.value()).to_vec(); 
                    mem_storage.set(&next_key, &next_value);
                }
        
                // Or collect the remainder into a vector
                let _: Vec<KeyVal> = cursor.into_vec(0).await.unwrap();
            },
            None => {
                // No elements matched
            }
        }
        return  mem_storage;
    }

    pub async fn sync_to_db(&self) {
        // "start" and "end" being "None" leads to checking the whole storage range
        for (key, value) in self.storage.range(None,None, Order::Ascending) {
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