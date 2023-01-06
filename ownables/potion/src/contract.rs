use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, Metadata, OwnableStateResponse, QueryMsg};
use crate::state::{BRIDGE, Bridge, Config, CONFIG};
use cosmwasm_std::{to_binary, Binary};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cw2::set_contract_version;

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:ownable-demo";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

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
        color: get_random_color(msg.ownable_id),
        image: None,
        image_data: None,
        external_url: None,
        description: Some("Ownable potion that can be consumed".to_string()),
        name: Some("Potion".to_string()),
        background_color: None,
        animation_url: None,
        youtube_url: None,
    };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    CONFIG.save(deps.storage, &state)?;
    BRIDGE.save(deps.storage, &Bridge {
        bridge: None,
        is_bridged: false,
    })?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", info.sender.clone())
        .add_attribute("issuer", info.sender)
        .add_attribute("color", state.color)
        .add_attribute("current_amount", state.max_capacity.to_string()))
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

pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Consume { amount } => try_consume(info, deps, amount),
        ExecuteMsg::Transfer { to } => try_transfer(info, deps, to),
        ExecuteMsg::SetBridge { bridge } => try_set_bridge(info, deps, bridge),
        ExecuteMsg::Bridge {} => try_bridge(info, deps),
        ExecuteMsg::Release { to } => try_release(info, deps, to),
    }
}

pub fn try_bridge(info: MessageInfo, deps: DepsMut) -> Result<Response, ContractError> {
    // only ownable owner can bridge it
    let mut config = CONFIG.load(deps)?;
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {
            val: "Unauthorized".into(),
        });
    }

    // validate bridge is set
    let mut bridge = BRIDGE.load(deps)?;
    if let None = bridge.bridge {
        return Err(ContractError::BridgeError {
            val: "No bridge set".to_string(),
        });
    }

    // transfer ownership to bridge and update bridge state
    let bridge_addr = bridge.bridge.unwrap();
    config.owner = bridge_addr;
    bridge.is_bridged = true;
    CONFIG.save(deps.storage, &config)?;
    BRIDGE.save(deps.storage, &bridge)?;

    Ok(Response::new()
        .add_attribute("method", "try_bridge")
        .add_attribute("is_bridged", bridge.is_bridged)
    )
}

pub fn try_release(info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    let mut bridge = BRIDGE.load(deps)?;
    match bridge.bridge {
        // validate bridge is set
        None => return Err(ContractError::BridgeError {
            val: "No bridge set".to_string() }
        ),
        Some(addr) => {
            // validate bridge is releasing the ownable
            if info.sender != addr {
                return Err(ContractError::BridgeError {
                    val: "Only bridge can release the ownable".to_string() }
                )
            }
        }
    }

    // transfer ownership and clear the bridge
    let mut config = CONFIG.load(deps)?;
    config.owner = to;
    bridge.is_bridged = false;
    bridge.bridge = None;

    CONFIG.save(deps.storage, &config)?;
    BRIDGE.save(deps.storage, &bridge)?;

    Ok(Response::new()
        .add_attribute("method", "try_release")
        .add_attribute("is_bridged", bridge.is_bridged)
        .add_attribute("owner", config.owner)
    )
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
    Ok(Response::new()
        .add_attribute("method", "try_consume")
        .add_attribute(
            "new_amount",
            CONFIG.load(deps.storage).unwrap().current_amount.to_string()
        )
    )
}

pub fn try_transfer(info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    CONFIG.update(deps.storage, |mut config| -> Result<_, ContractError> {
        if info.sender != config.owner {
            return Err(ContractError::Unauthorized {
                val: "Unauthorized transfer attempt".to_string(),
            });
        }
        config.owner = to.clone();
        Ok(config)
    })?;
    Ok(Response::new()
        .add_attribute("method", "try_transfer")
        .add_attribute("new_owner", to.to_string())
    )
}

pub fn try_set_bridge(info: MessageInfo, deps: Deps, addr: Option<Addr>) -> Result<Response, ContractError> {
    let owner = CONFIG.load(deps.storage)?.owner;
    if info.sender != owner {
        return Err(ContractError::Unauthorized {
            val: "Unauthorized".into(),
        });
    }

    let mut resp = Response::new()
        .add_attribute("method", "try_set_bridge");

    BRIDGE.update(deps.storage, |mut bridge| {
        match bridge.bridge {
            Some(b) => {
                resp = resp.add_attribute("addr", b);
            },
            None => {
                resp = resp.add_attribute("addr", "None");
            }
        }
        bridge.bridge = addr;
        Ok(bridge)
    })?;
    Ok(resp)
}

pub fn query(deps: Deps, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetOwnableConfig {} => query_ownable_config(deps),
        QueryMsg::GetOwnableMetadata {} => query_ownable_metadata(deps),
        QueryMsg::GetBridgeAddress {} => query_bridge_address(deps),
        QueryMsg::IsBridged {} => query_bridge_state(deps),
    }
}

fn query_bridge_address(deps: Deps) -> StdResult<Binary> {
    let bridge = BRIDGE.load(deps.storage)?;
    to_binary(&bridge.bridge)
}

fn query_bridge_state(deps: Deps) -> StdResult<Binary> {
    let bridge = BRIDGE.load(deps.storage)?;
    to_binary(&bridge.is_bridged)
}

fn query_ownable_config(deps: Deps) -> StdResult<Binary> {
    let config = CONFIG.load(deps.storage)?;
    to_binary(&OwnableStateResponse {
        owner: config.owner.into_string(),
        issuer: config.issuer.into_string(),
        current_amount: config.current_amount,
        max_capacity: config.max_capacity,
        color: config.color,
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
    use std::marker::PhantomData;
    use super::*;
    use cosmwasm_std::testing::{mock_env, mock_info};
    use cosmwasm_std::{Addr, OwnedDeps, MemoryStorage, Response, MessageInfo};
    use crate::utils::{EmptyApi, EmptyQuerier};

    struct CommonTest {
        deps: OwnedDeps<MemoryStorage, EmptyApi, EmptyQuerier>,
        info: MessageInfo,
        res: Response,
    }
    fn setup_test() -> CommonTest {
        let mut deps = OwnedDeps {
            storage: MemoryStorage::default(),
            api: EmptyApi::default(),
            querier: EmptyQuerier::default(),
            custom_query_type: PhantomData,
        };
        let info = mock_info("sender-1", &[]);

        let msg = InstantiateMsg {
            ownable_id: "2bJ69cFXzS8AJTcCmzjc9oeHZmBrmMVUr8svJ1mTGpho9izYrbZjrMr9q1YwvY".to_string(),
            image: None,
            image_data: None,
            external_url: None,
            description: Some("ownable to consume".to_string()),
            name: Some("Potion".to_string()),
            background_color: None,
            animation_url: None,
            youtube_url: None
        };

        let res: Response = instantiate(deps.as_mut(), mock_env(), info.clone(), msg).unwrap();

        CommonTest {
            deps,
            info,
            res,
        }
    }

    #[test]
    fn test_initialize() {

        let CommonTest {
            deps: _,
            info: _,
            res,
        } = setup_test();

        assert_eq!(0, res.messages.len());
        assert_eq!(res.attributes.get(0).unwrap().value, "instantiate".to_string());
        assert_eq!(res.attributes.get(1).unwrap().value, "sender-1".to_string());
        assert_eq!(res.attributes.get(2).unwrap().value, "sender-1".to_string());
        assert!(res.attributes.get(3).unwrap().value.starts_with("#"));
        assert_eq!(res.attributes.get(3).unwrap().value.len(), 7);
        assert_eq!(res.attributes.get(4).unwrap().value, "100".to_string());
    }

    #[test]
    fn test_consume() {
        let CommonTest {
            mut deps,
            info,
            res: _,
        } = setup_test();
        let deps = deps.as_mut();

        let msg = ExecuteMsg::Consume { amount: 50 };
        let res: Response = execute(deps, mock_env(), info, msg).unwrap();

        assert_eq!(0, res.messages.len());
        assert_eq!(res.attributes.get(0).unwrap().value, "try_consume".to_string());
        assert_eq!(res.attributes.get(1).unwrap().value, "50".to_string());
    }

    #[test]
    fn test_consume_unauthorized() {
        let CommonTest {
            mut deps,
            mut info,
            res: _,
        } = setup_test();
        let deps = deps.as_mut();
        info.sender = Addr::unchecked("not-the-owner".to_string());
        let msg = ExecuteMsg::Consume { amount: 50 };

        let err: ContractError = execute(deps, mock_env(), info, msg)
            .unwrap_err();

        let _expected_err_val = "Unauthorized consumption attempt".to_string();
        assert!(matches!(err, ContractError::Unauthorized { val: _expected_err_val, }));
    }

    #[test]
    fn test_overconsume() {
        let CommonTest {
            mut deps,
            info,
            res: _,
        } = setup_test();
        let deps = deps.as_mut();
        let msg = ExecuteMsg::Consume { amount: 150 };

        let err: ContractError = execute(deps, mock_env(), info, msg)
            .unwrap_err();

        let _expected_err_val = "attempt to consume more than possible".to_string();
        assert!(matches!(err, ContractError::CustomError { val: _expected_err_val }));
    }

    #[test]
    fn test_transfer() {
        let CommonTest {
            mut deps,
            info,
            res: _,
        } = setup_test();
        let deps = deps.as_mut();

        let msg = ExecuteMsg::Transfer { to: Addr::unchecked("other-owner-1") };

        let res: Response = execute(deps, mock_env(), info, msg).unwrap();

        assert_eq!(res.attributes.get(0).unwrap().value, "try_transfer".to_string());
        assert_eq!(res.attributes.get(1).unwrap().value, "other-owner-1".to_string());
    }

    #[test]
    fn test_transfer_unauthorized() {
        let CommonTest {
            mut deps,
            mut info,
            res: _,
        } = setup_test();
        let deps = deps.as_mut();
        info.sender = Addr::unchecked("not-the-owner".to_string());
        let msg = ExecuteMsg::Transfer { to: Addr::unchecked("not-the-owner") };

        let err: ContractError = execute(deps, mock_env(), info, msg)
            .unwrap_err();

        let _expected_err_val = "Unauthorized transfer attempt".to_string();
        assert!(matches!(err, ContractError::Unauthorized { val: _expected_err_val }));
    }

    #[test]
    fn test_query_config() {
        let CommonTest {
            deps,
            info: _,
            res: _,
        } = setup_test();

        let msg = QueryMsg::GetOwnableConfig {};
        let resp: Binary = query(deps.as_ref(), msg).unwrap();
        let json: String = "{\"owner\":\"sender-1\",\"issuer\":\"sender-1\",\"current_amount\":100,\"max_capacity\":100,\"color\":\"#11D539\"}".to_string();
        let expected_binary = Binary::from(json.as_bytes());

        assert_eq!(resp, expected_binary);
    }

    #[test]
    fn test_query_metadata() {
        let CommonTest {
            deps,
            info: _,
            res: _,
        } = setup_test();

        let msg = QueryMsg::GetOwnableMetadata {};
        let resp: Binary = query(deps.as_ref(), msg).unwrap();
        let json: String = "{\"image\":null,\"image_data\":null,\"external_url\":null,\"description\":\"Ownable potion that can be consumed\",\"name\":\"Potion\",\"background_color\":null,\"animation_url\":null,\"youtube_url\":null}".to_string();
        let expected_binary = Binary::from(json.as_bytes());

        assert_eq!(resp, expected_binary);
    }

}
