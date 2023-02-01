use cosmwasm_std::{MemoryStorage, Storage};

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
