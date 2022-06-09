use js_sys::{Function, Object, Reflect, WebAssembly};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::{spawn_local, JsFuture};

#[wasm_bindgen]
pub extern "C" fn add_five(arg: i32) -> i32 {
    arg + 5
}

#[wasm_bindgen]
pub fn add(arg: i32, arg2: i32) -> i32 {
    arg + arg2
}

#[wasm_bindgen]
pub fn return_string(arg: &str) -> String {
    format!("{} and stuff", arg)
}