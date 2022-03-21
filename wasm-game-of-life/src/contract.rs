#[cfg(not(feature = "library"))]
// use cosmwasm_std::entry_point;
use cosmwasm_std::{to_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
// use cw2::set_contract_version;

use crate::error::ContractError;
use crate::msg::{CountResponse, ExecuteMsg, InstantiateMsg, QueryMsg};
use crate::state::{State};
// use crate::store;

// version info for migration info
// const CONTRACT_NAME: &str = "crates.io:addr-contract";
// const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

// #[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    // deps: DepsMut,
    // _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let state = State {count: msg.count };
    state.store();

    // set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    // STATE.save(deps.storage, &state)?;


    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", info.sender)
        .add_attribute("count", msg.count.to_string()))
}

// #[cfg_attr(not(feature = "library"), entry_point)]
// #[wasm_bindgen]
pub fn execute(
    // deps: DepsMut,
    // _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Increment { by } => try_increment( by ),
        ExecuteMsg::Reset { count } => try_reset(count),
    }
}

pub fn try_increment(by: Option<i32>) -> Result<Response, ContractError> {
    let state = State::load();
    state.update(by.unwrap_or(1));

    Ok(Response::new().add_attribute("method", "try_increment"))
}

pub fn try_reset(count: i32) -> Result<Response, ContractError> {
    let state = State::load();
    state.reset(count);

    Ok(Response::new().add_attribute("method", "reset"))
}

pub fn query(msg: QueryMsg) -> StdResult<CountResponse> {
    match msg {
        QueryMsg::GetCount {} => query_count(),
    }
}

fn query_count() -> StdResult<CountResponse> {
let state = State::load();
    Ok(CountResponse { count: state.count })
}