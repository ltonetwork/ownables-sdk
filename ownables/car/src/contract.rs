use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, Metadata, OwnableStateResponse, QueryMsg};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Binary, to_binary};
use cw2::set_contract_version;
use crate::state::{Config, CONFIG};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:ownable-car-demo";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

// #[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    _msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let config = Config {
        owner: info.sender.clone(),
        issuer: info.sender.clone(),
        image: None,
        image_data: None,
        external_url: None,
        description: Some("Ownable car".to_string()),
        name: Some("Car".to_string()),
        background_color: None,
        animation_url: None,
        youtube_url: None
    };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", info.sender.clone())
        .add_attribute("issuer", info.sender))
}

// #[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Transfer { to } => try_transfer(info, deps, to),
    }
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
        };
        let info = mock_info("3MqSr5YNmLyvjdCZdHveabdE9fSxLXccNr1", &coins(1000, "earth"));

        // we can just call .unwrap() to assert this was a success
        let res = instantiate(deps.as_mut(), mock_env(), info, msg).unwrap();
        assert_eq!(0, res.messages.len());

        // it worked, let's query the state
        let res = query(deps.as_ref(), QueryMsg::GetOwnableState {}).unwrap();
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
