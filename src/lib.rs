pub mod utils;
use std::str;

use contract::instantiate;
use cosmwasm_std::MessageInfo;
use js_sys::{Promise};
use msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use serde_json::to_string;
use wasm_bindgen::prelude::*;

use utils::{create_lto_env, load_lto_deps};

pub mod contract;
pub mod error;
pub mod msg;
pub mod state;
pub mod store;

#[wasm_bindgen(module = "/www/idb-store.js")]
extern "C" {
    pub type IdbStore;

    #[wasm_bindgen(constructor)]
    fn new(arg: JsValue) -> IdbStore;
    #[wasm_bindgen(method)]
    fn get(this: &IdbStore, key: &[u8]) -> Promise;
    #[wasm_bindgen(method)]
    fn get_all_idb_keys(this: &IdbStore) -> Promise;
    #[wasm_bindgen(method)]
    fn put(this: &IdbStore, key: &[u8], value: &[u8]) -> Promise;
    #[wasm_bindgen(method)]
    async fn clear(this: &IdbStore);
}

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

#[wasm_bindgen]
pub async fn instantiate_contract(msg: JsValue, info: JsValue, idb: IdbStore) -> Result<JsValue, JsError> {
    let msg: InstantiateMsg = msg.into_serde().unwrap();
    let info: MessageInfo = info.into_serde().unwrap();
    let mut deps = load_lto_deps(&idb).await;

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
            deps.storage.sync_to_js_db(&idb).await;
            Ok(JsValue::from(to_string(&response).unwrap()))
        }
        Err(error) => {
            Err(JsError::from(error))
        }
    }
}

#[wasm_bindgen]
pub async fn execute_contract(
    msg: JsValue,
    info: JsValue,
    ownable_id: String,
    idb: IdbStore
) -> Result<JsValue, JsError> {
    let message: ExecuteMsg = msg.into_serde().unwrap();
    let info: MessageInfo = info.into_serde().unwrap();
    let mut deps = load_lto_deps(&idb).await;

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
            deps.storage.sync_to_js_db(&idb).await;
            Ok(JsValue::from(to_string(&response).unwrap()))
        }
        Err(error) => {
            log("[contract] failed to execute msg");
            Err(JsError::from(error))
        }
    }
}

#[wasm_bindgen]
pub async fn query_contract_state(idb: IdbStore) -> Result<JsValue, JsError> {
    let deps = load_lto_deps(&idb).await;
    let message: QueryMsg = QueryMsg::GetOwnableState {};

    let query_result = contract::query(deps.as_ref(), message);
    match query_result {
        Ok(potion_response) => Ok(JsValue::from_serde(&potion_response).unwrap()),
        Err(error) => panic!("contract state query failed. error {:?}", error),
    }
}
