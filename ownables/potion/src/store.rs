use std::collections::HashMap;
use cosmwasm_std::{MemoryStorage, Order, Storage};
use crate::IdbStateDump;

pub struct IdbStorage {
    pub storage: MemoryStorage,
}

impl IdbStorage {
    pub fn load(idb: IdbStateDump) -> Self {
        let mut store = IdbStorage {
            storage: MemoryStorage::new(),
        };
        store.load_to_mem_storage(idb);
        store
    }

    pub fn load_to_mem_storage(&mut self, idb_state: IdbStateDump) {
        for (k, v) in idb_state.state_dump.into_iter() {
            self.storage.set(&k, &v);
        }
    }
}

impl IdbStateDump {
    pub fn from(store: MemoryStorage) -> IdbStateDump {
        let mut state: HashMap<Vec<u8>, Vec<u8>> = HashMap::new();

        for (key, value) in store.range(None,None, Order::Ascending) {
            state.insert(key, value);
        }
        IdbStateDump {
            state_dump: state,
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
