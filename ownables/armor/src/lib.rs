extern crate core;

pub mod utils;

use std::str;

use contract::instantiate;
use cosmwasm_std::{MemoryStorage, MessageInfo, Response};
use msg::{ExecuteMsg, InstantiateMsg};
use serde_json::{to_string};
use wasm_bindgen::prelude::*;

use utils::{create_lto_env, load_lto_deps};
use crate::msg::{ExternalEvent, IdbStateDump};

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

    let msg: InstantiateMsg = serde_wasm_bindgen::from_value(msg)?;
    let info: MessageInfo = serde_wasm_bindgen::from_value(info)?;
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
                &to_string(&response)?
            ));
            let resp = get_json_response(deps.storage, response)?;
            Ok(resp)
        }
        Err(error) => {
            log(&format!("[error] failed to instantiate consumable. {:?}", error));
            Err(JsError::from(error))
        },
    }
}

fn get_json_response(storage: MemoryStorage, response: Response) -> Result<JsValue, JsError> {
    let state_dump= IdbStateDump::from(storage);
    let ownable_state = to_string(&response)?;
    let response_map = js_sys::Map::new();
    response_map.set(
        &JsValue::from_str("mem"),
        &JsValue::from(serde_json::to_string(&state_dump)?)
    );
    response_map.set(
        &JsValue::from_str("result"),
        &JsValue::from(ownable_state)
    );
    Ok(JsValue::from(response_map))
}

#[wasm_bindgen]
pub async fn execute_contract(
    msg: JsValue,
    info: JsValue,
    ownable_id: String,
    idb: JsValue,
) -> Result<JsValue, JsError> {
    let message: ExecuteMsg = serde_wasm_bindgen::from_value(msg.clone())?;
    let info: MessageInfo = serde_wasm_bindgen::from_value(info)?;
    let state_dump: IdbStateDump = serde_wasm_bindgen::from_value(idb)?;
    let mut deps = load_lto_deps(Some(state_dump));

    log(&format!(
        "[contract] executing message {:?} for ownable_id #{:?}",
        &msg, ownable_id
    ));

    let result = contract::execute(
        deps.as_mut(),
        create_lto_env(),
        info,
        message
    );

    match result {
        Ok(response) => {
            log(&format!(
                "[contract] successfully executed msg. response {:?}",
                &to_string(&response)?
            ));
            let resp = get_json_response(deps.storage, response)?;
            Ok(resp)
        }
        Err(error) => {
            log("[contract] failed to execute msg");
            Err(JsError::from(error))
        }
    }
}

#[wasm_bindgen]
pub async fn register_external_event(
    msg: JsValue,
    info: JsValue,
    ownable_id: String,
    idb: JsValue,
) -> Result<JsValue, JsError> {
    let external_event: ExternalEvent = serde_wasm_bindgen::from_value(msg.clone())?;
    let info: MessageInfo = serde_wasm_bindgen::from_value(info)?;
    let state_dump: IdbStateDump = serde_wasm_bindgen::from_value(idb)?;
    let mut deps = load_lto_deps(Some(state_dump));

    log(&format!(
        "[contract] registering external event {:?} for ownable_id #{:?}",
        &external_event, ownable_id
    ));

    let result = contract::register_external_event(
        info,
        deps.as_mut(),
        external_event,
    );

    match result {
        Ok(response) => {
            log(&format!(
                "[contract] successfully registered external event: {:?}",
                &to_string(&response)?
            ));
            let resp = get_json_response(deps.storage, response)?;
            Ok(resp)
        }
        Err(error) => {
            log("[contract] failed to register external event");
            Err(JsError::from(error))
        }
    }
}

#[wasm_bindgen]
pub async fn query_contract_state(
    msg: JsValue,
    idb: JsValue,
) -> Result<JsValue, JsError> {
    let state_dump: IdbStateDump = serde_wasm_bindgen::from_value(idb)?;
    let deps = load_lto_deps(Some(state_dump));

    let query_result = contract::query(
        deps.as_ref(),
        create_lto_env(),
        serde_wasm_bindgen::from_value(msg)?
    );

    match query_result {
        Ok(paint_response) => {
            log(&format!(
                "[contract] successfully queried msg. response {:?}",
                &to_string(&paint_response)?
            ));

            let ownable_state = to_string(&paint_response)?;
            let response_map = js_sys::Map::new();
            response_map.set(
                &JsValue::from_str("result"),
                &JsValue::from(ownable_state)
            );
            Ok(JsValue::from(response_map))
        },
        Err(error) => panic!("contract state query failed. error {:?}", error),
    }
}
