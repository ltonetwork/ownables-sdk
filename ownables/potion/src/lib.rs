pub mod utils;

use std::collections::HashMap;
use std::ops::Add;
use std::str;

use contract::instantiate;
use cosmwasm_std::{MemoryStorage, MessageInfo, Response, Storage};
use js_sys::Promise;
use serde::Serialize;
use msg::{ExecuteMsg, InstantiateMsg};
use serde_json::{Map, to_string, Value};
use wasm_bindgen::prelude::*;

use utils::{create_lto_env, load_lto_deps};
use crate::msg::IdbStateDump;

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
pub async fn instantiate_contract(
    msg: JsValue,
    info: JsValue,
) -> Result<JsValue, JsError> {
    let msg: InstantiateMsg = msg.into_serde().unwrap();
    let info: MessageInfo = info.into_serde().unwrap();
    let mut deps = load_lto_deps(None);

    log(&format!(
        "[contract] instantiate message {:?} for ownable_id #{:?}",
        &msg, &msg.ownable_id
    ));
    let res = instantiate(deps.as_mut(), create_lto_env(), info, msg);

    match res {
        Ok(response) => {
            log(&format!(
                "[contract] successfully instantiated msg. response {:}",
                &to_string(&response).unwrap()
            ));
            let resp = get_json_response(deps.storage, response);
            Ok(resp)
        }
        Err(error) => Err(JsError::from(error)),
    }
}

fn get_json_response(storage: MemoryStorage, response: Response) -> JsValue {
    let state_dump= IdbStateDump::from(storage);
    let ownable_state = to_string(&response).unwrap();
    let mut response_map = js_sys::Map::new();
    response_map.set(
        &JsValue::from_str("mem"),
        &JsValue::from(serde_json::to_string(&state_dump).unwrap())
    );
    response_map.set(
        &JsValue::from_str("state"),
        &JsValue::from(ownable_state)
    );
    JsValue::from(response_map)
}

#[wasm_bindgen]
pub async fn execute_contract(
    msg: JsValue,
    info: JsValue,
    ownable_id: String,
    idb: JsValue,
) -> Result<JsValue, JsError> {
    let message: ExecuteMsg = msg.into_serde().unwrap();
    let info: MessageInfo = info.into_serde().unwrap();
    // TODO:
    let state_dump: IdbStateDump = serde_json::from_str(&*idb.as_string().unwrap()).unwrap();

    let mut deps = load_lto_deps(Some(state_dump.clone()));

    log(&format!(
        "[contract] executing message {:?} for ownable_id #{:?}",
        &msg, ownable_id
    ));

    let result = contract::execute(deps.as_mut(), create_lto_env(), info, message);

    match result {
        Ok(response) => {
            log(&format!(
                "[contract] successfully executed msg. response {:}",
                &to_string(&response).unwrap()
            ));
            let state_dump: IdbStateDump = IdbStateDump::from(deps.storage);
            Ok(JsValue::from(to_string(&response).unwrap()))
        }
        Err(error) => {
            log("[contract] failed to execute msg");
            Err(JsError::from(error))
        }
    }
}

#[wasm_bindgen]
pub async fn query_contract_state(
    msg: JsValue,
    info: JsValue,
    idb: JsValue,
) -> Result<JsValue, JsError> {
    let state_dump: IdbStateDump = idb.into_serde().unwrap();
    let mut deps = load_lto_deps(Some(state_dump));

    let query_result = contract::query(deps.as_ref(), msg.into_serde().unwrap());
    match query_result {
        Ok(potion_response) => Ok(JsValue::from_serde(&potion_response).unwrap()),
        Err(error) => panic!("contract state query failed. error {:?}", error),
    }
}
