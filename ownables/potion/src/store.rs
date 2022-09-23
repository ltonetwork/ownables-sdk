use std::collections::HashMap;
use cosmwasm_std::{MemoryStorage, Order, Record, Storage};
use js_sys::{Array, Uint8Array};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use crate::IdbStateDump;

pub struct IdbStorage {
    pub storage: MemoryStorage,
}

impl Storage for IdbStorage {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        self.storage.get(key)
    }

    fn range<'a>(
        &'a self,
        start: Option<&[u8]>,
        end: Option<&[u8]>,
        order: Order,
    ) -> Box<dyn Iterator<Item = Record> + 'a> {
        self.storage.range(start, end, order)
    }

    fn set(&mut self, key: &[u8], value: &[u8]) {
        self.storage.set(key, value)
    }

    fn remove(&mut self, key: &[u8]) {
        self.storage.remove(key)
    }
}

impl IdbStorage {
    pub fn load(idb: IdbStateDump) -> Self {
        let mut store = IdbStorage {
            storage: MemoryStorage::new(),
        };
        store.load_to_mem_storage(idb);
        store
    }

    pub fn set_item(&mut self, key: &[u8], value: &[u8]) {
        self.storage.set(&key, &value);
    }

    pub fn get_item(&self, key: &[u8]) -> Vec<u8> {
        let result = self.storage.get(key);
        match result {
            None => Vec::new(),
            Some(val) => val
        }
    }

    pub fn load_to_mem_storage(&mut self, idb_state: IdbStateDump) {
        for (k, v) in idb_state.state_dump.into_iter() {
            self.storage.set(&k, &v);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_and_set() {
        let mut store = MemoryStorage::new();
        assert_eq!(store.get(b"foo"), None);
        store.set(b"foo", b"bar");
        assert_eq!(store.get(b"foo"), Some(b"bar".to_vec()));
        assert_eq!(store.get(b"food"), None);
    }

    #[test]
    #[should_panic(
        expected = "Getting empty values from storage is not well supported at the moment."
    )]
    fn set_panics_for_empty() {
        let mut store = MemoryStorage::new();
        store.set(b"foo", b"");
    }

    #[test]
    fn delete() {
        let mut store = MemoryStorage::new();
        store.set(b"foo", b"bar");
        store.set(b"food", b"bank");
        store.remove(b"foo");

        assert_eq!(store.get(b"foo"), None);
        assert_eq!(store.get(b"food"), Some(b"bank".to_vec()));
    }
}
