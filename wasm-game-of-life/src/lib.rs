mod utils;
use std::str;
use cosmwasm_std::{MessageInfo, Addr};
use error::ContractError;
use msg::{EventBody, ExecuteMsg, QueryMsg, CountResponse};
use serde_json::Error;
// use utils::MessageInfo;
use wasm_bindgen::prelude::*;
use wasm_bindgen_test::wasm_bindgen_test;

pub mod msg;
pub mod state;
pub mod store;
pub mod error;
pub mod contract;


// use crate::msg::{CountResponse, ExecuteMsg, QueryMsg, InstantiateMsg};

#[wasm_bindgen]
pub fn initialize() {
    utils::set_panic_hook()
}

#[wasm_bindgen]
extern {
    fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
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
    let res = match result {
        Ok(response) => response,
        Err(error) => panic!("contract resulted in error :{:?}", error)
    };
    
}

#[wasm_bindgen]
pub fn query_state() -> i32 {
    let msg = QueryMsg::GetCount();
    let query_result = contract::query(msg);
    match query_result {
        Ok(count_response) => return count_response.count,
        Err(error) => panic!("contract query failed. {:?}", error)
    }
}
#[wasm_bindgen]
pub fn query(msg: &JsValue) -> i32 {
    // let msg_string: String = msg.as_string().unwrap();
    // log(&msg_string);
    let message: QueryMsg = msg.into_serde().unwrap();
    let query_result = contract::query(message);
    match query_result {
        Ok(count_response) => return count_response.count,
        Err(error) => panic!("contract query failed. errpr {:?}", error)
    }
}
    

// #[wasm_bindgen]
// pub fn instantiate(count: JsValue) {} 



// pub fn instantiate(info: MessageInfo ,msg: InstantiateMsg) -> State {
//     // create an initial event for the eventchain
//     let state = State {
//         count: msg.count,
//     };

//     return state;
// }

#[cfg(test)]
mod tests {
    use wasm_bindgen::JsValue;
    use crate::query;

    use crate::state::{State};
    use crate::msg::{ QueryMsg };
    extern crate serde_json;
    #[test]
    fn create_state_from_json() {
        let state = State {count: 0};
        let json_string = serde_json::to_string(&state);
        println!("{:?}",json_string)
    }

    // fn test_query_jsvalue() {
    //     let value = JsValue::from_serde(&QueryMsg::GetCount()).unwrap();
    //     query(&value);
    // }
}
    
