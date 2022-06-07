#[no_mangle]
pub extern "C" fn age(cy: i32, yob: i32) -> i32 {
    cy - yob
}

// The wasm_import_module key may be used to specify the 
// WebAssembly module name for the items within an extern 
// block when importing symbols from the host environment. 
// The default module name is env if wasm_import_module is not specified.
#[link(wasm_import_module = "imports")]
extern "C" {
    fn imported_func(arg: i32);
    fn add_five(arg: i32) -> i32;
}

#[no_mangle]
pub extern "C" fn exported_func(arg: i32) {
    unsafe { imported_func(arg) }
}

#[no_mangle]
pub extern "C" fn imported_add_five(arg: i32) -> i32 {
    unsafe { add_five(arg) }
}
