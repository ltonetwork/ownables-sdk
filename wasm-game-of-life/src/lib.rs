mod utils;
use std::str;
use cosmwasm_std::{MessageInfo, Addr};
use msg::{EventBody, ExecuteMsg};
use serde_json::Error;
// use utils::MessageInfo;
use wasm_bindgen::prelude::*;
use js_sys::{Array, JSON};

pub mod msg;
pub mod state;
pub mod store;
pub mod error;
pub mod contract;

use crate::state::State;
// use crate::msg::{CountResponse, ExecuteMsg, QueryMsg, InstantiateMsg};


#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn square(number: i32) -> i32 {
    alert("computing square...");
    number * number
}

#[wasm_bindgen]
pub fn execute(msg: &JsValue) {
    let message: ExecuteMsg = msg.into_serde().unwrap();
    let result = contract::execute(MessageInfo {sender: Addr::unchecked(""),funds: Vec::new()} , message);
}

#[wasm_bindgen]
pub fn instantiate(count: JsValue) {} 



// pub fn instantiate(info: MessageInfo ,msg: InstantiateMsg) -> State {
//     // create an initial event for the eventchain
//     let state = State {
//         count: msg.count,
//     };

//     return state;
// }
