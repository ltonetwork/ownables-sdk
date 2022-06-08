use wasm_lib::common;


#[link(wasm_import_module = "imports")]
extern "C" {
    fn add_five(arg: i32) -> i32;
    fn create(count: i32) -> common::Msg;
    fn inc(msg: common::Msg, count: i32) -> common::Msg;
}

#[no_mangle]
pub extern "C" fn imported_add_five(arg: i32) -> i32 {
    unsafe { add_five(arg) + 3 }
}

#[no_mangle]
pub extern "C" fn do_something(count: i32, description: String) -> String {
    let msg = unsafe { create(count) };
    let result = unsafe { inc(msg, 5) };

    result.describe()
}

#[no_mangle]
pub extern "C" fn do_something_count(count: i32) -> i32 {
    let msg = unsafe { create(count) };
    
    if (msg.count != count) {
        return -1
    }

    msg.count
}