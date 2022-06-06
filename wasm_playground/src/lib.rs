#[no_mangle]
pub extern "C" fn age(cy: i32, yob: i32) -> i32 {
    cy - yob
}

#[link(wasm_import_module = "imports")]
extern "C" {
    fn imported_func(arg: i32);
}

#[no_mangle]
pub extern "C" fn exported_func(arg: i32) {
    unsafe { imported_func(arg) }
}