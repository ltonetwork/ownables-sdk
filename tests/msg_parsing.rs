extern crate wasm_bindgen_test;

use std::{assert, panic};
use js_sys::JSON;
use serde::Serialize;
use serde_json::json;
use wasm_bindgen_test::*;
use wasm_bindgen::prelude::*;
use ownable_demo::msg::{ExecuteMsg, QueryMsg, InstantiateMsg};
use std::str;

#[wasm_bindgen_test]
fn parse_js_value_to_msg(){
    let js_object = JSON::parse("{\"increment\":{ \"by\":\"1\"}}").unwrap();
    println!("{:?}", js_object);

    let    msg: ExecuteMsg = js_object.into_serde().unwrap();

    println!("{:?}", & json!(msg));
}