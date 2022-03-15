use js_sys::JSON;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
extern crate serde_json;

use crate::store::Store; 

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct State {
    pub count: i32,
    // pub owner: Addr,
}

impl State {
    pub fn load() -> State {
        let store = Store::new("test_store");
        
        let state: State = serde_json::from_str(store.data).unwrap();
        return state;
    }

    fn update(self, count: i32) {
        self.count += count;
        let store = Store::new("test_store");
        store.data = serde_json::to_string(&self).unwrap();
        store.sync_local_storage();
    }

    fn store(self) {
        let store = Store::new("test_store");
        store.data = serde_json::to_string(&self).unwrap();
        store.sync_local_storage();
    }

    fn reset(self, reset_val:i32) {
        self.count = reset_val;
        
        let store = Store::new("test_store");
        store.data = serde_json::to_string(&self).unwrap();
        store.sync_local_storage();
    }
    
}