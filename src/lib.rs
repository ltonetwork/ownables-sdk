pub mod utils;
use std::str;

use contract::instantiate;
use cosmwasm_std::{Addr, MessageInfo};
use msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use serde_json::to_string;
use wasm_bindgen::prelude::*;

use utils::{create_lto_env, load_lto_deps};

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
pub async fn instantiate_contract(msg: JsValue) -> Result<(), JsError> {
    let msg: InstantiateMsg = msg.into_serde().unwrap();
    // let info: MessageInfo = info.into_serde().unwrap();

    let mut deps = load_lto_deps(&msg.ownable_id).await;

    let res = instantiate(
        deps.as_mut(),
        create_lto_env(),
        MessageInfo {
            sender: Addr::unchecked("info.sender"),
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
pub async fn execute_contract(msg: JsValue, ownable_js_id: JsValue) -> Result<(), JsError> {
    // load from indexed db
    log(&format!(
        "[contract] executing message {:?} for ownable_id #{:?}",
        &msg, &ownable_js_id
    ));
    let ownable_id: String = ownable_js_id.into_serde().unwrap();

    let mut deps = load_lto_deps(&ownable_id).await;
    // add the storage to the deps

    let message: ExecuteMsg = msg.into_serde().unwrap();
    let result = contract::execute(
        deps.as_mut(),
        create_lto_env(),
        MessageInfo {
            sender: Addr::unchecked("info.sender"),
            funds: Vec::new(),
        },
        message,
    );
    match result {
        Ok(response) => {
            let resp_json = to_string(&response);
            log(&format!(
                "[contract] successfully executed msg. response {:}",
                &resp_json.unwrap()
            ));
            deps.storage.sync_to_db().await;
            Ok(())
        }
        Err(error) => Err(JsError::from(error)),
    }
}

#[wasm_bindgen]
pub async fn query_contract_state(ownable_js_id: JsValue) -> Result<JsValue, JsError> {
    let ownable_id: String = ownable_js_id.into_serde().unwrap();
    let deps = load_lto_deps(&ownable_id).await;

    let message: QueryMsg = QueryMsg::GetCurrentAmount {};
    let query_result = contract::query(deps.as_ref(), message);
    match query_result {
        Ok(potion_response) => Ok(JsValue::from_serde(&potion_response).unwrap()),
        Err(error) => panic!("contract state query failed. error {:?}", error),
    }
}
