use js_sys::JSON;
use wasm_bindgen::prelude::*;


/// Stores items into localstorage
pub struct Store {
    local_storage: web_sys::Storage,
    data: String,
    name: String,
}

impl Store {
    /// Creates a new store with `name` as the localstorage value name
    pub fn new(name: &str) -> Option<Store> {
        let window = web_sys::window()?;
        if let Ok(Some(local_storage)) = window.local_storage() {
            let mut store = Store {
                local_storage,
                data: "",
                name: String::from(name),
            };
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
        let mut item_list = ItemList::new();
        // If we have an existing cached value, return early.
        if let Ok(Some(value)) = self.local_storage.get_item(&self.name) {
            let data = JSON::parse(&value).ok()?;
        }
        self.data = item_list;
        Some(())
    }

    /// Write the local ItemList to localStorage.
    fn sync_local_storage(&mut self) {
        let array = js_sys::Array::new();
        
        if let Ok(storage_string) = self.data {
            let storage_string: String = storage_string.into();
            self.local_storage
                .set_item(&self.name, &storage_string)
                .unwrap();
        }
    }

    /// Update an item in the Store.
    ///
    /// `ItemUpdate` update Record with an id and a property to update
    pub fn update(&mut self, data: String) {
        self.data = data;
        self.sync_local_storage();
    }

}