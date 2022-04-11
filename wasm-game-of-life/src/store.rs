use std::{iter};

use cosmwasm_std::{Storage, Record, Order};
use indexed_db_futures::prelude::*;
use futures::{executor::block_on};
use wasm_bindgen::{JsValue};
use js_sys::Uint8Array;



/// Stores items into localstorage
pub struct LocalStorage {
    local_storage: web_sys::Storage,
    data: String,
    name: String,
}

impl LocalStorage {
    /// Creates a new store with `name` as the localstorage value name
    pub fn new(name: &str) -> Option<LocalStorage> {
        let window = web_sys::window()?;
        if let Ok(Some(local_storage)) = window.local_storage() {
            let mut store = LocalStorage {
                local_storage,
                data: String::from("{\"count\":0}"),
                name: String::from(name),
            };
            // store.sync_local_storage();
            store.fetch_local_storage();
            Some(store)
        } else {
            None
        }
    }


    /// Read the local ItemList from localStorage.
    /// Returns an &Option<ItemList> of the stored database
    /// Caches the store into `self.data` to reduce calls to JS
    ///
    /// Uses mut here as the return is something we might want to manipulate
    ///
    fn fetch_local_storage(&mut self) -> Option<()> {

        // If we have an existing cached value, return early.
        if let Ok(Some(value)) = self.local_storage.get_item(&self.name) {
            let data = value;
            self.data = data;
        }
        Some(())
    }

    /// Write the local ItemList to localStorage.
    fn sync_local_storage(&self) {
        let storage_string: String = self.data.as_str().to_string() ;

        self.local_storage
            .set_item(&self.name, &storage_string)
            .unwrap();
    }

    /// Update an item in the Store.
    ///
    /// `ItemUpdate` update Record with an id and a property to update
    pub fn update(mut self, data: String) {
        self.data = data;
        self.sync_local_storage();
    }

    pub fn get_data(&self) -> &str {
        self.data.as_str()
    }
}
/// This wrapper is only to make it recognisable by cosmwasmstd:deps
impl Storage for LocalStorage {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        None
        // TODO: implement getting value from local store
    }

    fn set(&mut self, key: &[u8], value: &[u8]) {
        if value.is_empty() { panic!("value is empty") }
        // TODO: implement setting value in local store
    }

    fn remove(&mut self, key: &[u8]) {
        // self.data.remove(key);
        // TODO: Implement removing value from local store
    }

    fn range<'a>(
        &'a self,
        start: Option<&[u8]>,
        end: Option<&[u8]>,
        order: Order,
    ) -> Box<dyn Iterator<Item = Record> + 'a> {
        if true { panic!("This method is not implemented.") }
        return Box::new(iter::empty())
        // TODO: find a solution for this
    }
}

// #[derive(Default)]
pub struct IdbStorage {
    db: IdbDatabase,
}

impl IdbStorage {
    pub fn new() -> Self {
        let mut db_req: OpenDbRequest = IdbDatabase::open_u32("my_db", 1).unwrap();
        db_req.set_on_upgrade_needed(Some(|evt: &IdbVersionChangeEvent| -> Result<(), JsValue> {
            // Check if the object store exists; create it if it doesn't
            if let None = evt.db().object_store_names().find(|n| n == "my_store") {
                evt.db().create_object_store("my_store")?;
            }
            Ok(())
        }));

        let program = async { 
            let async_res = db_req.into_future().await;
            return async_res.unwrap();
        };

        let db: IdbDatabase = block_on(program);

        return IdbStorage {db: db};

    }
}

impl Default for IdbStorage {
    fn default() -> Self {
        Self::new()
    }
}

impl Storage for IdbStorage {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {

        let tx = self.db.transaction_on_one("my_store").unwrap();
        let store = tx.object_store("my_store").unwrap();
        let program = async { 
            let async_res = store.get_owned(Uint8Array::from(key)).unwrap().await;
            return async_res.unwrap();
        };

        let res = block_on(program);
        
        // let res = block_on(async { 
        //     let async_res = store.get_owned(Uint8Array::from(key)).unwrap().await;
        //     return async_res.unwrap();
        
        // } );
            
        let array = Uint8Array::new(&(res.unwrap()));
        return Some(array.to_vec());
    }

    fn range<'a>(
        &'a self,
        _start: Option<&[u8]>,
        _end: Option<&[u8]>,
        _order: Order,
    ) -> Box<dyn Iterator<Item = Record> + 'a> {
        todo!()
    }

    /// TODO: Properly unwrap all the values
    fn set(&mut self, key: &[u8], value: &[u8]) {

        let tx = self.db.transaction_on_one_with_mode("my_store", IdbTransactionMode::Readwrite).unwrap();
        let store = tx.object_store("my_store").unwrap();
        let program = async { 
            let async_res = store.get_owned(Uint8Array::from(key)).unwrap().await;
            return async_res.unwrap();
        };

        // let res = block_on(async { 
        //     let async_res = store.get_owned(Uint8Array::from(key)).unwrap().await;
        //     return async_res.unwrap();
        // });
        let res = block_on(program);

        let array = Uint8Array::new(&(res.unwrap()));
        if array.to_vec() != value.to_vec() {
            let _ = store.put_key_val_owned(Uint8Array::from(key) , &Uint8Array::from(value)).unwrap();
        }
    }

    fn remove(&mut self, key: &[u8]) {
        let tx = self.db.transaction_on_one_with_mode("my_store", IdbTransactionMode::Readwrite).unwrap();
        let store = tx.object_store("my_store").unwrap();
        let _ = store.delete_owned(Uint8Array::from(key)).unwrap();
    }
}