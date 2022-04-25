//! Test suite for the Web and headless browsers.

#![cfg(target_arch = "wasm32")]


extern crate wasm_bindgen_test;
use std::{assert, debug_assert, println, assert_eq};

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
    let store = IdbStorage::create_db("leipe_db").await;
    debug_assert!(true);
}

#[wasm_bindgen_test]
async fn set_and_get() {
    // TODO: check the mechanics of the indexed db and fix the current issue

    let mut store = block_on(IdbStorage::new());
    store.set_item(b"foo", b"bar").await;
    // FIXME: The store finds None for key b"foo". async request isnt finished probably
    assert_eq!(store.get(b"foo").unwrap(), b"bar");
}


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

