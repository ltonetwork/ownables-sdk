pub mod utils;
use std::str;

use contract::instantiate;
use cosmwasm_std::{MessageInfo};
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
pub async fn instantiate_contract(msg: JsValue, info: JsValue) -> Result<JsValue, JsError> {
    let msg: InstantiateMsg = msg.into_serde().unwrap();
    let info: MessageInfo = info.into_serde().unwrap();

    let mut deps = load_lto_deps(&msg.ownable_id).await;

    let res = instantiate(
        deps.as_mut(),
        create_lto_env(),
        info,
        msg,
    );

    match res {
        Ok(response) => {
            deps.storage.sync_to_db().await;
            deps.storage.close();
            Ok(JsValue::from(to_string(&response).unwrap()))
        }
        Err(error) => {
            deps.storage.close();
            Err(JsError::from(error))
        },
    }
}

#[wasm_bindgen]
pub async fn execute_contract(
    msg: JsValue,
    info: JsValue,
    ownable_js_id: JsValue
) -> Result<JsValue, JsError> {
    let ownable_id: String = ownable_js_id.into_serde().unwrap();
    let message: ExecuteMsg = msg.into_serde().unwrap();
    let info: MessageInfo = info.into_serde().unwrap();
    let mut deps = load_lto_deps(&ownable_id).await;

    log(&format!(
        "[contract] executing message {:?} for ownable_id #{:?}",
        &msg, &ownable_js_id
    ));

    let result = contract::execute(
        deps.as_mut(),
        create_lto_env(),
        info,
        message,
    );

    match result {
        Ok(response) => {
            log(&format!(
                "[contract] successfully executed msg. response {:}",
                &to_string(&response).unwrap()
            ));
            deps.storage.sync_to_db().await;
            deps.storage.close();
            Ok(JsValue::from(to_string(&response).unwrap()))
        }
        Err(error) => {
            log(&format!(
                "[contract] failed to execute msg"
            ));
            deps.storage.close();
            Err(JsError::from(error))
        },
    }
}

#[wasm_bindgen]
pub async fn query_contract_state(ownable_js_id: JsValue) -> Result<JsValue, JsError> {
    let ownable_id: String = ownable_js_id.into_serde().unwrap();
    let deps = load_lto_deps(&ownable_id).await;

    let message: QueryMsg = QueryMsg::GetPotionState {};
    let query_result = contract::query(deps.as_ref(), message);
    deps.storage.close();
    match query_result {
        Ok(potion_response) => Ok(JsValue::from_serde(&potion_response).unwrap()),
        Err(error) => panic!("contract state query failed. error {:?}", error),
    }
}
