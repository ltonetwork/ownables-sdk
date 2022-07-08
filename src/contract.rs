#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cw2::set_contract_version;

use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, PotionStateResponse, QueryMsg};
use crate::state::{State, STATE};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:ownable-demo";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

// #[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let state = State {
        owner: info.sender.clone(),
        issuer: info.sender.clone(),
        max_capacity: msg.max_capacity,
        current_amount: msg.max_capacity,
    };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    STATE.save(deps.storage, &state)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", info.sender.clone())
        .add_attribute("issuer", info.sender)
        .add_attribute("capacity", msg.max_capacity.to_string()))
}

// #[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Consume { amount } => try_consume(info, deps, amount),
        ExecuteMsg::Transfer { to } => try_transfer(info, deps, to),
    }
}

pub fn try_consume(
    info: MessageInfo,
    deps: DepsMut,
    consumption_amount: u8,
) -> Result<Response, ContractError> {
    STATE.update(deps.storage, |mut state| -> Result<_, ContractError> {
        if info.sender != state.owner {
            return Err(ContractError::Unauthorized {
                val: "Unauthorized consumption attempt".to_string(),
            });
        }
        if state.current_amount < consumption_amount {
            return Err(ContractError::CustomError {
                val: "attempt to consume more than possible".to_string(),
            });
        }
        state.current_amount -= consumption_amount;
        Ok(state)
    })?;
    Ok(Response::new().add_attribute("method", "try_consume"))
}

pub fn try_transfer(info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    STATE.update(deps.storage, |mut state| -> Result<_, ContractError> {
        if info.sender != state.owner {
            return Err(ContractError::Unauthorized {
                val: "Unauthorized transfer attempt".to_string(),
            });
        }
        state.owner = to;
        Ok(state)
    })?;
    Ok(Response::new().add_attribute("method", "try_transfer"))
}

// #[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, msg: QueryMsg) -> StdResult<PotionStateResponse> {
    match msg {
        QueryMsg::GetCurrentAmount {} => query_potion_state(deps),
    }
}

fn query_potion_state(deps: Deps) -> StdResult<PotionStateResponse> {
    let state = STATE.load(deps.storage)?;
    Ok(PotionStateResponse {
        owner: state.owner.into_string(),
        issuer: state.issuer.into_string(),
        current_amount: state.current_amount,
        max_capacity: state.max_capacity,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::coins;
    use cosmwasm_std::testing::{mock_dependencies_with_balance, mock_env, mock_info};

    #[test]
    fn proper_initialization() {
        let mut deps = mock_dependencies_with_balance(&coins(2, "token"));

        let msg = InstantiateMsg {
            max_capacity: 17,
            ownable_id: "0".to_string(),
            contract_id: "c-id-1".to_string(),
        };
        let info = mock_info("creator", &coins(1000, "earth"));

        // we can just call .unwrap() to assert this was a success
        let res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(0, res.messages.len());

        // it worked, let's query the state
        let res = query(deps.as_ref(), QueryMsg::GetCurrentAmount {}).unwrap();

        assert_eq!(17, res.max_capacity);
    }

    #[test]
    fn consume_some() {
        let mut deps = mock_dependencies_with_balance(&coins(2, "token"));

        let msg = InstantiateMsg {
            max_capacity: 100,
            ownable_id: "0".to_string(),
            contract_id: "c-id-1".to_string(),
        };
        let info = mock_info("creator", &coins(2, "token"));
        let _res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();

        // should only allow owner to consume
        let info = mock_info("random", &coins(2, "token"));
        let msg = ExecuteMsg::Consume { amount: 10 };
        let res = execute(deps.as_mut(), mock_env(), info, msg);
        match res {
            Err(ContractError::Unauthorized { .. }) => {}
            _ => panic!("Must return unauthorized error"),
        }

        // creator can consume it
        let info = mock_info("creator", &coins(2, "token"));
        let msg = ExecuteMsg::Consume { amount: 10 };
        let _res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // should decrease capacity by 10
        let res = query(deps.as_ref(), QueryMsg::GetCurrentAmount {}).unwrap();
        // let value: PotionStateResponse = res).unwrap();
        assert_eq!(90, res.current_amount);

        // should fail to consume more than available
        let info = mock_info("creator", &coins(2, "token"));
        let msg = ExecuteMsg::Consume { amount: 95 };
        let res = execute(deps.as_mut(), mock_env(), info, msg);
        match res {
            Err(ContractError::CustomError { val }) => {
                assert_eq!(val, "attempt to consume more than possible")
            }
            _ => panic!("Must return custom error"),
        }
    }

    // #[test]
    // fn transfer() {
    //     let mut deps = mock_dependencies_with_balance(&coins(2, "token"));
    //
    //     let msg = InstantiateMsg {
    //         max_capacity: 17,
    //         ownable_id: "0".to_string(),
    //         contract_id: "c-id-1".to_string()
    //     };
    //     let info = mock_info("issuer", &coins(2, "token"));
    //     let _res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
    //
    //     // should not allow random user to transfer what she does not own
    //     let info = mock_info("random", &coins(2, "token"));
    //     let msg = ExecuteMsg::Transfer {
    //         to: Addr::unchecked("random"),
    //     };
    //     let res = execute(deps.as_mut(), mock_env(), info.clone(), msg);
    //     match res {
    //         Err(ContractError::Unauthorized {}) => {}
    //         _ => panic!("Must return unauthorized error"),
    //     }
    //
    //     let info = mock_info("issuer", &coins(2, "token"));
    //     let msg = ExecuteMsg::Transfer {
    //         to: Addr::unchecked("new_owner"),
    //     };
    //     let _res = execute(deps.as_mut(), mock_env(), info.clone(), msg).unwrap();
    //
    //     // verify new owner
    //     let res = query(deps.as_ref(), QueryMsg::GetOwner {}).unwrap();
    //     let value: OwnershipResponse = res.unwrap();
    //     assert_eq!(value.owner, Addr::unchecked("new_owner"));
    // }
}
