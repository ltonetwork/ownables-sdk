pub mod utils;
use std::str;

use contract::instantiate;
use cosmwasm_std::{Addr, MessageInfo};
use msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use serde_json::to_string;
use wasm_bindgen::prelude::*;

use utils::{create_lto_deps, create_lto_env, load_lto_deps};
// use crate::msg::{OwnershipResponse, PotionStateResponse};

pub mod contract;
pub mod error;
pub mod msg;
pub mod state;
pub mod store;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

#[wasm_bindgen]
pub fn square(number: i32) -> i32 {
    log("computing square...");
    number * number
}

#[wasm_bindgen]
pub async fn instantiate_contract(
    msg: JsValue,
) -> Result<(), JsError> {

    let msg: InstantiateMsg = msg.into_serde().unwrap();
    let mut deps = create_lto_deps(&msg.ownable_id).await;

    let res = instantiate(
        deps.as_mut(),
        create_lto_env(),
        MessageInfo {
            sender: Addr::unchecked(""),
            funds: Vec::new(),
        },
        msg,
    );

    match res {
        Ok(response) => {
            let resp_json = to_string(&response);
            log(&format!(
                "[contract] successfully instantiated! response {:}",
                &resp_json.unwrap()
            ));
            deps.storage.sync_to_db().await;
            Ok(())
        }
        Err(error) => Err(JsError::from(error)),
    }
}

#[wasm_bindgen]
pub async fn execute_contract(
    msg: JsValue,
    ownable_js_id: JsValue
) -> Result<(), JsError> {
    // load from indexed db
    log(&format!("[contract] executing message {:?}", &msg));
    let ownable_id: String = ownable_js_id.into_serde().unwrap();

    let mut deps = load_lto_deps(&ownable_id).await;
    // add the storage to the deps

    let message: ExecuteMsg = msg.into_serde().unwrap();
    let result = contract::execute(
        deps.as_mut(),
        create_lto_env(),
        MessageInfo {
            sender: Addr::unchecked(""),
            funds: Vec::new(),
        },
        message,
    );
    match result {
        Ok(response) => {
            let resp_json = to_string(&response);
            log(&format!(
                "[contract] succesfully excuted msg. response {:}",
                &resp_json.unwrap()
            ));
            deps.storage.sync_to_db().await;
            Ok(())
        }
        Err(error) => Err(JsError::from(error)),
    }
}

#[wasm_bindgen]
pub async fn query_contract_state(ownable_js_id: JsValue) -> u8 {
    let ownable_id: String = ownable_js_id.into_serde().unwrap();
    let deps = load_lto_deps(&ownable_id).await;

    let message: QueryMsg = QueryMsg::GetCurrentAmount {};
    let query_result = contract::query(deps.as_ref(), message);
    match query_result {
        Ok(potion_response) => potion_response.current_amount,
        Err(error) => panic!("contract state query failed. error {:?}", error),
    }
}

// #[wasm_bindgen]
// pub async fn query_contract_owner(ownable_js_id: JsValue) -> String {
//     let ownable_id: String = ownable_js_id.into_serde().unwrap();
//     let deps = load_lto_deps(&ownable_id).await;
//
//     let message = QueryMsg::GetOwner {};
//     let query_result = contract::query(deps.as_ref(), message);
//     let ownership_response: OwnershipResponse = from_binary(query_result.unwrap().into()).into();
//     match ownership_response {
//         Ok(ownership_response) => {
//             ownership_response.owner
//         },
//         Err(error) => panic!("contract owner query failed. error {:?}", error)
//     }
// }
