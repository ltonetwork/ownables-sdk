use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, Metadata, OwnableStateResponse, QueryMsg};
use crate::state::{Config, CONFIG};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Binary, to_binary};
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
    let state = Config {
        owner: info.sender.clone(),
        issuer: info.sender.clone(),
        max_capacity: 100,
        current_amount: 100,
        color_hex: get_random_color(msg.ownable_id),
        image: None,
        image_data: None,
        external_url: None,
        description: Some("Ownable potion that can be consumed".to_string()),
        name: Some("Potion".to_string()),
        background_color: None,
        animation_url: None,
        youtube_url: None
    };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    CONFIG.save(deps.storage, &state)?;

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
    CONFIG.update(deps.storage, |mut state| -> Result<_, ContractError> {
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
    CONFIG.update(deps.storage, |mut config| -> Result<_, ContractError> {
        if info.sender != config.owner {
            return Err(ContractError::Unauthorized {
                val: "Unauthorized transfer attempt".to_string(),
            });
        }
        config.owner = to;
        Ok(config)
    })?;
    Ok(Response::new().add_attribute("method", "try_transfer"))
}

// #[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetOwnableConfig {} => query_ownable_config(deps),
        QueryMsg::GetOwnableMetadata {} => query_ownable_metadata(deps),
    }
}

fn query_ownable_config(deps: Deps) -> StdResult<Binary> {
    let config = CONFIG.load(deps.storage)?;
    to_binary(&OwnableStateResponse {
        owner: config.owner.into_string(),
        issuer: config.issuer.into_string(),
        current_amount: config.current_amount,
        max_capacity: config.max_capacity,
        color_hex: config.color_hex,
    })
}

fn query_ownable_metadata(deps: Deps) -> StdResult<Binary> {
    let config = CONFIG.load(deps.storage)?;
    to_binary(&Metadata {
        image: config.image,
        image_data: config.image_data,
        external_url: config.external_url,
        description: config.description,
        name: config.name,
        background_color: config.background_color,
        animation_url: config.animation_url,
        youtube_url: config.youtube_url,
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
            image: None,
            image_data: None,
            external_url: None,
            description: None,
            name: None,
            background_color: None,
            animation_url: None,
            youtube_url: None
        };
        let info = mock_info("3MqSr5YNmLyvjdCZdHveabdE9fSxLXccNr1", &coins(1000, "earth"));

        // we can just call .unwrap() to assert this was a success
        let res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(0, res.messages.len());

        // it worked, let's query the state
        let res = query(deps.as_ref(), QueryMsg::GetOwnableConfig {}).unwrap();

        assert_eq!(17, res.max_capacity);
    }

    #[test]
    fn consume_some() {
        let mut deps = mock_dependencies_with_balance(&coins(2, "token"));

        let msg = InstantiateMsg {
            ownable_id: "mD6PjEigks2pY3P819F8HFX96nsD8q8pyyLNN3pH28o".to_string(),
            image: None,
            image_data: None,
            external_url: None,
            description: None,
            name: None,
            background_color: None,
            animation_url: None,
            youtube_url: None
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
        let res = query(deps.as_ref(), QueryMsg::GetOwnableConfig {}).unwrap();
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
            image: None,
            image_data: None,
            external_url: None,
            description: None,
            name: None,
            background_color: None,
            animation_url: None,
            youtube_url: None
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
        let res: OwnableStateResponse = query(deps.as_ref(), QueryMsg::GetOwnableConfig {}).unwrap();
        assert_eq!(res.owner, Addr::unchecked("3MpM7ZJfgavsA9wB6rpvagJ2dBGehXjomTh"));
    }
}
