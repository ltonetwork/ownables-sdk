use crate::error::ContractError;
use crate::msg::{ExecuteMsg, ExternalEvent, InstantiateMsg, Metadata, OwnableStateResponse, QueryMsg};
use crate::state::{BRIDGE, Bridge, Config, CONFIG, Cw721, CW721};
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
    };

    let cw721 = Cw721 {
        image: None,
        image_data: None,
        external_url: None,
        description: Some("Ownable potion that can be consumed".to_string()),
        name: Some("Potion".to_string()),
        background_color: None,
        animation_url: None,
        youtube_url: None,
    };

    let bridge = Bridge {
        is_bridged: false,
        network: msg.network,
        nft_id: msg.nft_id,
        nft_contract_address: msg.nft_contract,
    };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    CONFIG.save(deps.storage, &state)?;
    BRIDGE.save(deps.storage, &bridge)?;
    CW721.save(deps.storage, &cw721)?;

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
                .cloned()
                .unwrap_or_default();
            let nft_id = event.args.get("token_id")
                .cloned()
                .unwrap_or_default();
            let locking_contract_addr = event.args.get("source_contract")
                .cloned()
                .unwrap_or_default();

            if owner.is_empty() ||
                nft_id.is_empty() ||
                locking_contract_addr.is_empty() ||
                event.args.len() > 3 {
                return Err(ContractError::InvalidExternalEventArgs {});
            }

            try_register_lock(
                info,
                deps,
                event.chain_id,
                owner.to_string(),
                nft_id.to_string(),
                locking_contract_addr,
            )?;
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
    nft_id: String,
    locking_contract_addr: String,
) -> Result<Response, ContractError> {
    let bridge = BRIDGE.load(deps.storage).unwrap();
    if bridge.nft_id.to_string() != nft_id {
        return Err(ContractError::BridgeError {
            val: "nft_id mismatch".to_string()
        });
    } else if bridge.network != chain_id {
        return Err(ContractError::BridgeError {
            val: "network mismatch".to_string()
        });
    } else if bridge.nft_contract_address != locking_contract_addr {
        return Err(ContractError::BridgeError {
            val: "locking contract mismatch".to_string()
        });
    }

    let caip_2_fields: Vec<&str> = chain_id.split(":").collect();
    let namespace = caip_2_fields.get(0).unwrap();
    let reference = caip_2_fields.get(1).unwrap();

    match *namespace {
        "eip155" => {
            let address = address_eip155(owner)?;
            Ok(try_release(info, deps, address)?)
        }
        "lto" => {
            let network_fields: Vec<char> = reference.chars().collect();
            if network_fields.len() > 1 {
                return Err(ContractError::MatchChainIdError { val: chain_id });
            }
            let network_id = network_fields.get(0).unwrap();
            let address = address_lto(*network_id, owner)?;
            Ok(try_release(info, deps, address)?)
        }
        _ => return Err(ContractError::MatchChainIdError { val: chain_id }),
    }
}

pub fn try_lock(info: MessageInfo, deps: DepsMut) -> Result<Response, ContractError> {
    // only ownable owner can bridge it
    let config = CONFIG.load(deps.storage)?;
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {
            val: "Unauthorized".into(),
        });
    }

    let bridge = BRIDGE.update(
        deps.storage,
        |mut b| -> Result<_, ContractError> {
            if b.is_bridged {
                return Err(
                    ContractError::BridgeError { val: "Already bridged".to_string() }
                );
            }
            b.is_bridged = true;
            Ok(b)
        })?;

    Ok(Response::new()
        .add_attribute("method", "try_bridge")
        .add_attribute("is_locked", bridge.is_bridged.to_string())
    )
}

fn try_release(_info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    let mut bridge = BRIDGE.load(deps.storage)?;
    if !bridge.is_bridged {
        return Err(ContractError::BridgeError { val: "Not bridged".to_string() });
    }

    // transfer ownership and clear the bridge
    let mut config = CONFIG.load(deps.storage)?;
    config.owner = to;
    bridge.is_bridged = false;

    CONFIG.save(deps.storage, &config)?;
    BRIDGE.save(deps.storage, &bridge)?;

    Ok(Response::new()
        .add_attribute("method", "try_release")
        .add_attribute("is_bridged", bridge.is_bridged.to_string())
        .add_attribute("owner", config.owner.to_string())
    )
}

pub fn try_consume(
    info: MessageInfo,
    deps: DepsMut,
    consumption_amount: u8,
) -> Result<Response, ContractError> {
    let bridge = BRIDGE.load(deps.storage)?;
    if bridge.is_bridged {
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
    if bridge.is_bridged {
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
    to_binary(&bridge)
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
    let cw721 = CW721.load(deps.storage)?;
    to_binary(&Metadata {
        image: cw721.image,
        image_data: cw721.image_data,
        external_url: cw721.external_url,
        description: cw721.description,
        name: cw721.name,
        background_color: cw721.background_color,
        animation_url: cw721.animation_url,
        youtube_url: cw721.youtube_url,
    })
}
