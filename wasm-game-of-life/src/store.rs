use std::{iter};

use cosmwasm_std::{Storage, Record, Order};
use web_sys;


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

impl Storage for LocalStorage {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        None
        // TODO: implement getting value from local store
    }

    fn set(&mut self, key: &[u8], value: &[u8]) {
        if value.is_empty() {panic!("no ")}
        // TODO: implement setting value in local store
    }

    fn remove(&mut self, key: &[u8]) {
        self.data.remove(key);
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