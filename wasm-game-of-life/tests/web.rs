//! Test suite for the Web and headless browsers.

#![cfg(target_arch = "wasm32")]


extern crate wasm_bindgen_test;
use std::{assert, println};
use wasm_bindgen_test::*;
use cosmwasm_std::Storage;


use wasm_game_of_life::store::IdbStorage;
use wasm_game_of_life::log;



wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
async fn initialise_new_store() {
    let _store = IdbStorage::new().await;
}

#[wasm_bindgen_test]
async fn load_store() {
    let mut store = IdbStorage::load("test_load").await;

    store.load_to_mem_storage().await;
}

#[wasm_bindgen_test]
/// tests if the data in idb is copied correctly to the memstore when initiating IdbStorage
async fn test_load_single_key_to_mem_storage() {
    let mut store = IdbStorage::new().await;
    store.set_item(b"key1", b"value1").await;

    store.load_key_to_mem_storage(b"key1").await;

    let value1 = store.get(b"key1").unwrap();
    assert!(value1 == b"value1", "value from idb isnt copied correctly to the memory storage");
}

#[wasm_bindgen_test]
/// tests if the data in idb is copied correctly to the memstore when initiating IdbStorage
async fn test_load_single_key_from_mem_storage() {
    let mut store = IdbStorage::new().await;
    store.set(b"key1", b"value1");

    // store.load_key_to_mem_storage(b"key1").await;
    store.load_key_from_mem_storage(b"key1").await;

    let value1 = store.get_item(b"key1").await;
    assert!(value1 == b"value1", "value from idb isnt copied correctly to the memory storage");
}

#[wasm_bindgen_test]
async fn set_and_get_memstore() {
    // TODO: check the mechanics of the indexed db and fix the current issue

    let mut store = IdbStorage::new().await;
    // join!(store);

    store.set(b"foo", b"bar");
    
    let value = store.get(b"foo").unwrap(); //.unwrap_or(b"0");
    assert!(!value.is_empty(), "value for key after set is foun null");
    assert!(value == b"bar", "get from memstore for key 'foo' is unsuccesfull after set");
}


#[wasm_bindgen_test]
async fn set_item_in_idb() {
    let store = IdbStorage::load("test_db").await;
    store.set_item(b"key1", b"value1").await;
}

#[wasm_bindgen_test]
async fn write_and_read_idb() {
    let store = IdbStorage::load("test_db").await;
    store.set_item(b"key1", b"value1").await;

    let value1 = store.get_item(b"key1").await;
    
    assert!(value1==b"value1", "value1 not set in idb");
}

#[wasm_bindgen_test]
async fn load_from_and_to_database() {
    log("start test load_from_and_to_database");
    let mut store = IdbStorage::load("test_db").await;
    log("load test load_from_and_to_database");
    store.set_item(b"key1", b"value1").await;
    store.set_item(b"key2", b"value2").await;
    store.set_item(b"key3", b"value3").await;
    println!("done init test load_from_and_to_database");
    
    store.load_to_mem_storage().await;

    // read from memory storage
    let value1 = store.get(b"key1").unwrap();

    assert!(value1 == b"value1", "value from idb is not correctly loaded to memmory");

    let value1a = b"value1a";

    // overwriting value of key1
    store.set(b"key1", value1a);
    let read_value1a = store.get(b"key1").unwrap();
    assert!(value1 != read_value1a, "value in memory stays the same after overwriting");
    assert!(value1a.to_vec() == read_value1a, "overwrite value in memory store is incorrect: should be {:x?}, but got {:x?}",value1a, read_value1a);

    // writing changes to idb storage
    store.sync_to_db().await;

    let idb_value1a = store.get_item(b"key1").await;
    let idb_value2a = store.get_item(b"key2").await;
    assert!(idb_value1a != b"value1", "changes in memstore aren't pushed through to idb  storage. value for key1 still the same");
    assert!(idb_value1a == b"value1a", "value for key1 didnt change according to the above instructions. Should have '{:x?}' but got '{:x?}'", b"value1a", idb_value1a);
    assert!(idb_value2a == b"value2", "value for key2 changed, unintentionally. should still be: {:x?}, but is now {:x?}",b"value2", idb_value2a );
}
#[wasm_bindgen_test]
async fn create_close_and_open_db() {
    let store = IdbStorage::load("test_db").await;
    store.set_item(b"key1", b"value1").await;


    let same_store = IdbStorage::load("test_db").await;
    let value = store.get_item(b"key1").await;
    assert!(value == b"value1")
}


// FIXME: The store finds None for key b"foo". async request isnt finished probably
// TODO: test read from idb store 
// TODO: test write to idb store 
// TODO: test read from idb store to memstore
// TODO: test read from memstore to idb store




// #[wasm_bindgen_test]
// fn get_and_set() {
//     log::warn!("loadding store...");
//     let mut store = IdbStorage::new();
//     assert_eq!(store.get(b"foo"), None, "The store already had some data");

//     log::warn!("setting data...");
//     store.set(b"foo", b"bar");
//     assert_eq!(store.get(b"foo"), Some(b"bar".to_vec()), "The data in the storage is not the same as we put in.");
//     assert_eq!(store.get(b"food"), None, "There is data with another key created");
// }

// #[wasm_bindgen_test]
// fn delete() {
//     let mut store = IdbStorage::new();
//     store.set(b"foo", b"bar");
//     store.set(b"food", b"bank");
//     store.remove(b"foo");

//     assert_eq!(store.get(b"foo"), None);
//     assert_eq!(store.get(b"food"), Some(b"bank".to_vec()));
// }

