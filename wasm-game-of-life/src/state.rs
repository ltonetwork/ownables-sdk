use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

extern crate serde_json;
use cw_storage_plus::Item;


// pub mod store;
// use crate::log;
// use crate::store::IdbStorage; 

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct State {
    pub count: i32
    // pub owner: Addr,
}

pub const STATE: Item<State> = Item::new("state");

impl State {
    // pub fn load() -> State {
    //     let store = LocalStorage::new("test_store").unwrap_throw();
    //     log(&store.get_data());
    //     let state: State = serde_json::from_str(store.get_data()).unwrap();
    //     return state;
    // }

    // pub fn update(mut self, count: i32) {
    //     self.count += count;
    //     let store = LocalStorage::new("test_store").unwrap_throw();
    //     let data = serde_json::to_string(&self).unwrap();
    //     store.update(data);
    // }

    // pub fn store(self) {
    //     let store = LocalStorage::new("test_store").unwrap_throw();
    //     let data = serde_json::to_string(&self).unwrap();
    //     store.update(data);
    // }

    // pub fn reset(mut self, reset_val:i32) {
    //     self.count = reset_val;
    //     let store = LocalStorage::new("test_store").unwrap_throw();
    //     let data = serde_json::to_string(&self).unwrap();
    //     store.update(data);
    // }
}



