use cosmwasm_std::{MemoryStorage, Order, Record, Storage};
use js_sys::{Array, Uint8Array};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use crate::{IdbStore};

pub struct IdbStorage {
    storage: MemoryStorage,
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

    pub async fn load(idb: &IdbStore) -> Self {
        let mut store = IdbStorage {
            storage: MemoryStorage::new(),
        };
        store.load_to_mem_storage(idb).await;
        store
    }

    pub async fn set_item(&self, idb: &IdbStore, key: &[u8], value: &[u8]) {
        let promise = idb.put(&key, &value);
        let future = JsFuture::from(promise);
        let _result = future.await.unwrap();
    }

    pub async fn get_item(&self, idb: &IdbStore, key: &[u8]) -> Vec<u8> {
        let promise = idb.get(key);
        let future = JsFuture::from(promise);
        let result: JsValue = future.await.unwrap();
        let array_data = Uint8Array::new(&result);
        let val: Vec<u8> = array_data.to_vec();
        val
    }

    pub async fn load_to_mem_storage(&mut self, idb_store: &IdbStore) {

        let promise = idb_store.get_all_idb_keys();
        let future = JsFuture::from(promise);
        let result: JsValue = future.await.unwrap();
        let arraydata: Array = JsCast::unchecked_from_js(result);

        if arraydata.to_vec().is_empty() {
            return;
        }
        for js_k in arraydata.iter() {
            let k = Uint8Array::new(&js_k).to_vec();
            let val = self.get_item(idb_store, &k).await;
            self.storage.set(&k, &val);
        }
    }

    pub async fn sync_to_js_db(&self, idb: &IdbStore) {
        for (key, value) in self.storage.range(None, None, Order::Ascending) {
            self.set_item(idb, &key, &value).await;
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
