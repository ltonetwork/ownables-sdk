//! Test suite for the Web and headless browsers.

#![cfg(target_arch = "wasm32")]


extern crate wasm_bindgen_test;
use std::{assert, debug_assert};

use indexed_db_futures::IdbDatabase;
use wasm_bindgen::__rt::assert_not_null;
use wasm_bindgen_test::*;
use cosmwasm_std::Storage;

use wasm_game_of_life::store::IdbStorage;
use wasm_game_of_life;
use log;

wasm_bindgen_test_configure!(run_in_browser);



#[wasm_bindgen_test]
fn initialise_store() {
    let store = IdbStorage::default();
    debug_assert!(true);
}

#[wasm_bindgen_test]
fn get_and_set() {
    log::warn!("loadding store...");
    let mut store = IdbStorage::new();
    assert_eq!(store.get(b"foo"), None, "The store already had some data");

    log::warn!("setting data...");
    store.set(b"foo", b"bar");
    assert_eq!(store.get(b"foo"), Some(b"bar".to_vec()), "The data in the storage is not the same as we put in.");
    assert_eq!(store.get(b"food"), None, "There is data with another key created");
}

#[wasm_bindgen_test]
fn delete() {
    let mut store = IdbStorage::new();
    store.set(b"foo", b"bar");
    store.set(b"food", b"bank");
    store.remove(b"foo");

    assert_eq!(store.get(b"foo"), None);
    assert_eq!(store.get(b"food"), Some(b"bank".to_vec()));
}