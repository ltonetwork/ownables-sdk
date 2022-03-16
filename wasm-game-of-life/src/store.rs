use js_sys::JSON;
use web_sys;


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
                data: String::new(),
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

        // If we have an existing cached value, return early.
        if let Ok(Some(value)) = self.local_storage.get_item(&self.name) {
            let data = value;
            self.data = data;
        }
        Some(())
    }

    /// Write the local ItemList to localStorage.
    fn sync_local_storage(self) {
        let storage_string: String = self.data ;

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

    pub fn get_data(self) -> String {
        self.data
    }

}