use wasm_lib::common;


#[link(wasm_import_module = "imports")]
extern "C" {
    fn add(a: u32, b: u32) -> u32;
    fn return_string() -> String;
    fn concat_string(name: &str) -> String;
}

#[no_mangle]
pub extern "C" fn imported_add(a: u32, b: u32) -> u32 {
    unsafe { add(a, b) }
}

#[no_mangle]
pub extern "C" fn imported_return_string() -> String {
    unsafe { return_string() }
}

#[no_mangle]
pub extern "C" fn imported_concat_string(name: &str) -> String {
    unsafe { concat_string(name) }
}

#[no_mangle]
pub extern "C" fn return_greeting(name: &str) -> String {
    format!("hello, {}", name)
}