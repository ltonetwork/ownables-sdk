use wasm_lib::common;

#[no_mangle]
pub extern "C" fn create(count: i32) -> common::Msg {
    common::Msg{ count }
}

#[no_mangle]
pub extern "C" fn inc(mut msg: common::Msg, count: i32) -> common::Msg {
    msg.inc(5);
    msg
}

#[no_mangle]
pub extern "C" fn add_five(arg: i32) -> i32 {
    arg + 5
}
