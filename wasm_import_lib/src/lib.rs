
#[no_mangle]
pub extern "C" fn print_i32(arg: i32) -> i32 {
    // web_sys::console::log_1(&"Hello World".into());
    arg
}

#[no_mangle]
pub extern "C" fn add_five(arg: i32) -> i32 {
    arg + 5
}