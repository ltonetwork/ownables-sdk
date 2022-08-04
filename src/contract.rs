use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, OwnableStateResponse, QueryMsg};
use crate::state::{State, STATE};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cw2::set_contract_version;

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
        max_capacity: 100,
        current_amount: 100,
        color_hex: get_random_color(msg.ownable_id),
    };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    STATE.save(deps.storage, &state)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", info.sender.clone())
        .add_attribute("issuer", info.sender)
        .add_attribute("color", state.color_hex)
        .add_attribute("capacity", state.max_capacity.to_string()))
}

fn get_random_color(hash: String) -> String {
    let (red, green, blue) = derive_rgb_values(hash);
    rgb_hex(red, green, blue)
}

fn derive_rgb_values(hash: String) -> (u8, u8, u8) {
    let mut decoded_hash = bs58::decode(&hash).into_vec().unwrap();
    decoded_hash.reverse();
    (decoded_hash[0], decoded_hash[1], decoded_hash[2])
}

fn rgb_hex(r: u8, g: u8, b: u8) -> String {
    format!("#{:02X}{:02X}{:02X}", r, g, b)
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
                val: "Unauthorized consumption attempt".into(),
            });
        }
        if state.current_amount < consumption_amount {
            return Err(ContractError::CustomError {
                val: "attempt to consume more than possible".into(),
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
pub fn query(deps: Deps, msg: QueryMsg) -> StdResult<OwnableStateResponse> {
    match msg {
        QueryMsg::GetOwnableState {} => query_potion_state(deps),
    }
}

fn query_potion_state(deps: Deps) -> StdResult<OwnableStateResponse> {
    let state = STATE.load(deps.storage)?;
    Ok(OwnableStateResponse {
        owner: state.owner.into_string(),
        issuer: state.issuer.into_string(),
        current_amount: state.current_amount,
        max_capacity: state.max_capacity,
        color_hex: state.color_hex,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::{Addr, coins};
    use cosmwasm_std::testing::{mock_dependencies_with_balance, mock_env, mock_info};

    #[test]
    fn proper_initialization() {
        let mut deps = mock_dependencies_with_balance(&coins(2, "token"));

        let msg = InstantiateMsg {
            ownable_id: "mD6PjEigks2pY3P819F8HFX96nsD8q8pyyLNN3pH28o".to_string(),
        };
        let info = mock_info("3MqSr5YNmLyvjdCZdHveabdE9fSxLXccNr1", &coins(1000, "earth"));

        // we can just call .unwrap() to assert this was a success
        let res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(0, res.messages.len());

        // it worked, let's query the state
        let res = query(deps.as_ref(), QueryMsg::GetOwnableState {}).unwrap();

        assert_eq!(17, res.max_capacity);
    }

    #[test]
    fn consume_some() {
        let mut deps = mock_dependencies_with_balance(&coins(2, "token"));

        let msg = InstantiateMsg {
            ownable_id: "mD6PjEigks2pY3P819F8HFX96nsD8q8pyyLNN3pH28o".to_string(),
        };
        let info = mock_info("3MqSr5YNmLyvjdCZdHveabdE9fSxLXccNr1", &coins(2, "token"));
        let _res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();

        // should only allow owner to consume
        let info = mock_info("3MpM7ZJfgavsA9wB6rpvagJ2dBGehXjomTh", &coins(2, "token"));
        let msg = ExecuteMsg::Consume { amount: 10 };
        let res = execute(deps.as_mut(), mock_env(), info, msg);
        match res {
            Err(ContractError::Unauthorized { .. }) => {}
            _ => panic!("Must return unauthorized error"),
        }

        // creator can consume it
        let info = mock_info("3MqSr5YNmLyvjdCZdHveabdE9fSxLXccNr1", &coins(2, "token"));
        let msg = ExecuteMsg::Consume { amount: 10 };
        let _res = execute(deps.as_mut(), mock_env(), info, msg).unwrap();

        // should decrease capacity by 10
        let res = query(deps.as_ref(), QueryMsg::GetOwnableState {}).unwrap();
        // let value: PotionStateResponse = res).unwrap();
        assert_eq!(90, res.current_amount);

        // should fail to consume more than available
        let info = mock_info("3MqSr5YNmLyvjdCZdHveabdE9fSxLXccNr1", &coins(2, "token"));
        let msg = ExecuteMsg::Consume { amount: 95 };
        let res = execute(deps.as_mut(), mock_env(), info, msg);
        match res {
            Err(ContractError::CustomError { val }) => {
                assert_eq!(val, "attempt to consume more than possible")
            }
            _ => panic!("Must return custom error"),
        }
    }

    #[test]
    fn transfer() {
        let mut deps = mock_dependencies_with_balance(&coins(2, "token"));

        let msg = InstantiateMsg {
            ownable_id: "mD6PjEigks2pY3P819F8HFX96nsD8q8pyyLNN3pH28o".to_string(),
        };
        let owner = "3MqSr5YNmLyvjdCZdHveabdE9fSxLXccNr1";
        let random = "3MpM7ZJfgavsA9wB6rpvagJ2dBGehXjomTh";

        let info = mock_info(owner, &coins(2, "token"));
        let _res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();

        // should not allow random user to transfer what she does not own
        let info = mock_info(random, &coins(2, "token"));
        let msg = ExecuteMsg::Transfer {
            to: Addr::unchecked(random),
        };
        let res = execute(deps.as_mut(), mock_env(), info.clone(), msg);
        match res {
            Err(ContractError::Unauthorized { .. }) => {}
            _ => panic!("Must return unauthorized error"),
        }

        let info = mock_info(owner, &coins(2, "token"));
        let msg = ExecuteMsg::Transfer {
            to: Addr::unchecked(random),
        };
        let _res = execute(deps.as_mut(), mock_env(), info.clone(), msg).unwrap();

        // verify new owner
        let res: OwnableStateResponse = query(deps.as_ref(), QueryMsg::GetOwnableState {}).unwrap();
        assert_eq!(res.owner, Addr::unchecked("3MpM7ZJfgavsA9wB6rpvagJ2dBGehXjomTh"));
    }
}
