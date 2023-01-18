use crate::error::ContractError;
use crate::msg::{ExecuteMsg, ExternalEvent, InstantiateMsg, Metadata, OwnableStateResponse, QueryMsg};
use crate::state::{BRIDGE, Bridge, Config, CONFIG};
use cosmwasm_std::{to_binary, Binary};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cw2::set_contract_version;
use crate::utils::{address_eip155, address_lto};

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
        is_locked: false,
        network: msg.network_id,
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
        ExecuteMsg::Bridge {} => try_lock(info, deps),
        ExecuteMsg::RegisterExternalEvent { event } => try_register_external_event(info, deps, event),
    }
}

pub fn try_register_external_event(
    info: MessageInfo,
    deps: DepsMut,
    event: ExternalEvent,
) -> Result<Response, ContractError> {
    let mut response = Response::new()
        .add_attribute("method", "register_external_event");

    match event.event_type.as_str() {
        "lock" => {
            let owner = event.args.get("owner")
                .unwrap()
                .to_string();
            let ownable_id = event.args.get("token_id")
                .unwrap()
                .to_string();
            try_register_lock(
                info,
                deps,
                event.chain_id,
                owner,
                ownable_id,
            ).unwrap();
            response = response.add_attribute("event_type", "lock");
        },
        _ => return Err(ContractError::MatchEventError { val: event.event_type }),
    };

    Ok(response)
}

fn try_register_lock(
    info: MessageInfo,
    deps: DepsMut,
    chain_id: String,
    owner: String,
    _ownable_id: String,
) -> Result<Response, ContractError> {
    match chain_id.as_str() {
        "eip155:1" => {
            let address = address_eip155(owner);
            try_release(info, deps, address).unwrap();
        },
        "lto:1" => {
            let bridge = BRIDGE.load(deps.storage).unwrap();
            let address = address_lto(bridge.network, owner);
            try_release(info, deps, address).unwrap();
        },
        _ => return Err(ContractError::MatchChainIdError { val: chain_id }),
    }
    Ok(())
}

pub fn try_lock(info: MessageInfo, deps: DepsMut) -> Result<Response, ContractError> {
    // only ownable owner can bridge it
    let mut config = CONFIG.load(deps.storage)?;
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {
            val: "Unauthorized".into(),
        });
    }

    let mut bridge = BRIDGE.update(
        deps.storage,
        |mut b| -> Result<_, ContractError> {
            b.is_locked = true;
            Ok(b)
        })?;

    Ok(Response::new()
        .add_attribute("method", "try_bridge")
        .add_attribute("is_locked", bridge.is_locked.to_string())
    )
}

fn try_release(info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    let mut bridge = BRIDGE.load(deps.storage)?;
    if !bridge.is_locked {
        return Err(ContractError::BridgeError { val: "Not bridged".to_string() });
    }

    // transfer ownership and clear the bridge
    let mut config = CONFIG.load(deps.storage)?;
    config.owner = to;
    bridge.is_locked = false;

    CONFIG.save(deps.storage, &config)?;
    BRIDGE.save(deps.storage, &bridge)?;

    Ok(Response::new()
        .add_attribute("method", "try_release")
        .add_attribute("is_bridged", bridge.is_locked.to_string())
        .add_attribute("owner", config.owner.to_string())
    )
}

pub fn try_consume(
    info: MessageInfo,
    deps: DepsMut,
    consumption_amount: u8,
) -> Result<Response, ContractError> {
    let bridge = BRIDGE.load(deps.storage)?;
    if bridge.is_locked {
        return Err(ContractError::BridgeError {
            val: "Unable to consume a bridged ownable".to_string(),
        });
    }

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
    let bridge = BRIDGE.load(deps.storage)?;
    if bridge.is_locked {
        return Err(ContractError::BridgeError {
            val: "Unable to transfer a bridged ownable".to_string(),
        });
    }

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

pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetOwnableConfig {} => query_ownable_config(deps),
        QueryMsg::GetOwnableMetadata {} => query_ownable_metadata(deps),
        QueryMsg::IsBridged {} => query_bridge_state(deps),
    }
}

fn query_bridge_state(deps: Deps) -> StdResult<Binary> {
    let bridge = BRIDGE.load(deps.storage)?;
    to_binary(&bridge.is_locked)
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
