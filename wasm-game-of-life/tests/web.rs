//! Test suite for the Web and headless browsers.

#![cfg(target_arch = "wasm32")]


extern crate wasm_bindgen_test;
use std::iter::empty;
use std::ptr::null;
use std::{assert, debug_assert, println, assert_eq, vec};

use futures::executor::block_on;
use indexed_db_futures::IdbDatabase;
use wasm_bindgen::__rt::assert_not_null;
use wasm_bindgen_test::*;
use cosmwasm_std::Storage;

use wasm_game_of_life::store::IdbStorage;
use wasm_game_of_life;
use log;

wasm_bindgen_test_configure!(run_in_browser);




#[wasm_bindgen_test]
async fn initialise_store() {
    let mut store = IdbStorage::new().await;

    block_on(store.load_to_mem_storage());
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

async fn prepare_test_idb() -> IdbStorage {
    let mut store = IdbStorage::load("test_db").await;
    store.set_item(b"key1", b"value1");
    store.set_item(b"key2", b"value2");
    store.set_item(b"key3", b"value3");
    return store;
}

#[wasm_bindgen_test]
async fn write_to_idb() {
    let mut store = prepare_test_idb().await;
    // let mut store = IdbStorage::load("test_db").await;
    let value1 = store.get_item(b"key1").await;
    
    assert!(value1==b"value1", "value1 not set");
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

