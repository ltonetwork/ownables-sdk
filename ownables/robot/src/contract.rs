use crate::error::ContractError;
use crate::msg::{ExecuteMsg, ExternalEvent, InstantiateMsg, Metadata, OwnableStateResponse, QueryMsg};
use crate::state::{NFT, Config, CONFIG, Cw721, CW721, LOCKED, NETWORK, Network, Ownership, OWNERSHIP};
use cosmwasm_std::{to_binary, Binary};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cw2::set_contract_version;
use crate::utils::{address_eip155, address_lto};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:ownable-robot";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    let network = Network {
        // id: msg.network_id,
        id: 76,
    };

    let derived_addr = address_lto(
        network.id as char,
        info.sender.to_string()
    )?;

    let ownership = Ownership {
        owner: derived_addr.clone(),
        issuer: derived_addr.clone(),
    };

    let state = Config {
        consumed_ownable_ids: vec![],
        color: rgb_hex(25, 82, 114),
        has_antenna: false,
        has_speaker: false,
        has_armor: false
    };

    let cw721 = Cw721 {
        image: None,
        image_data: None,
        external_url: None,
        description: Some("Ownable Robot".to_string()),
        name: Some("Robot".to_string()),
        background_color: None,
        animation_url: None,
        youtube_url: None,
    };

    CONFIG.save(deps.storage, &state)?;
    NETWORK.save(deps.storage, &network)?;
    // NFT.save(deps.storage, &msg.nft)?;
    CW721.save(deps.storage, &cw721)?;
    LOCKED.save(deps.storage, &false)?;
    OWNERSHIP.save(deps.storage, &ownership)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", info.clone().sender.to_string())
        .add_attribute("issuer", info.sender.to_string())
        .add_attribute("color", state.color)
    )
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
        ExecuteMsg::Transfer { to } => try_transfer(info, deps, to),
        ExecuteMsg::Lock {} => try_lock(info, deps),
    }
}

pub fn register_external_event(
    info: MessageInfo,
    deps: DepsMut,
    event: ExternalEvent,
    ownable_id: String,
) -> Result<Response, ContractError> {
    let mut response = Response::new()
        .add_attribute("method", "register_external_event");

    match event.event_type.as_str() {
        "lock" => {
            try_register_lock(
                info,
                deps,
                event,
            )?;
            response = response.add_attribute("event_type", "lock");
        },
        "consume" => {
            try_register_consume(
                info,
                deps,
                event,
                ownable_id,
            )?;
            response = response.add_attribute("event_type", "consume");

        }
        _ => return Err(ContractError::MatchEventError { val: event.event_type }),
    };

    Ok(response)
}

fn try_register_consume(
    info: MessageInfo,
    deps: DepsMut,
    event: ExternalEvent,
    ownable_id: String,
) -> Result<Response, ContractError> {

    let owner = event.args.get("owner")
        .cloned()
        .unwrap_or_default();
    let consumed_by = event.args.get("consumed_by")
        .cloned()
        .unwrap_or_default();
    let issuer = event.args.get("issuer")
        .cloned()
        .unwrap_or_default();
    let color = event.args.get("color")
        .cloned()
        .unwrap_or_default();

    let consumable_type = event.args.get("type")
        .cloned()
        .unwrap_or_default();

    if consumable_type.is_empty() || color.is_empty() || issuer.is_empty() || consumed_by.is_empty() || owner.is_empty() {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    let ownership = OWNERSHIP.load(deps.storage)?;

    // only owner can consume
    // if ownership.owner != info.sender.to_string() {
    //     return Err(ContractError::Unauthorized { val: "Only owner can consume".to_string() });
    // }

    // validate issuer of collection matches
    if ownership.issuer.to_string() != issuer {
        return Err(ContractError::InvalidExternalEventArgs {})
    }

    let mut config = CONFIG.load(deps.storage)?;
    match consumable_type.as_str() {
        "antenna" => {
            config.has_antenna = true;
        },
        "armor" => {
            config.has_armor = true;
        },
        "paint" => {
            config.color = color;
        },
        "speaker" => {
            config.has_speaker = true;
        },
        _ => {},
    }
    config.consumed_ownable_ids.push(Addr::unchecked(ownable_id));
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "try_register_consume")
        .add_attribute("status", "success")
    )
}

fn try_register_lock(
    info: MessageInfo,
    deps: DepsMut,
    event: ExternalEvent,
) -> Result<Response, ContractError> {
    let owner = event.args.get("owner")
        .cloned()
        .unwrap_or_default();
    let nft_id = event.args.get("token_id")
        .cloned()
        .unwrap_or_default();
    let contract_addr = event.args.get("contract")
        .cloned()
        .unwrap_or_default();

    if owner.is_empty() || nft_id.is_empty() || contract_addr.is_empty() {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    let nft = NFT.load(deps.storage).unwrap();
    if nft.nft_id.to_string() != nft_id {
        return Err(ContractError::LockError {
            val: "nft_id mismatch".to_string()
        });
    } else if nft.network != event.chain_id.clone() {
        return Err(ContractError::LockError {
            val: "network mismatch".to_string()
        });
    } else if nft.nft_contract_address != contract_addr {
        return Err(ContractError::LockError {
            val: "locking contract mismatch".to_string()
        });
    }

    let caip_2_fields: Vec<&str> = event.chain_id.split(":").collect();
    let namespace = caip_2_fields.get(0).unwrap();

    match *namespace {
        "eip155" => {
            // assert that owner address is the eip155 of info.sender pk
            let address = address_eip155(info.sender.to_string())?;
            if address != address_eip155(owner.clone())? {
                return Err(ContractError::Unauthorized {
                    val: "Only the owner can release an ownable".to_string(),
                });
            }

            let network = NETWORK.load(deps.storage)?;
            let address = address_lto(network.id as char, owner)?;
            Ok(try_release(info, deps, address)?)
        }
        _ => return Err(ContractError::MatchChainIdError { val: event.chain_id }),
    }
}

pub fn try_lock(info: MessageInfo, deps: DepsMut) -> Result<Response, ContractError> {
    // only ownable owner can lock it
    let ownership = OWNERSHIP.load(deps.storage)?;
    let network = NETWORK.load(deps.storage)?;
    let network_id = network.id as char;
    if address_lto(network_id, info.sender.to_string())? != ownership.owner {
        return Err(ContractError::Unauthorized {
            val: "Unauthorized".into(),
        });
    }

    let is_locked = LOCKED.update(
        deps.storage,
        |mut is_locked| -> Result<_, ContractError> {
            if is_locked {
                return Err(
                    ContractError::LockError { val: "Already locked".to_string() }
                );
            }
            is_locked = true;
            Ok(is_locked)
        }
    )?;

    Ok(Response::new()
        .add_attribute("method", "try_lock")
        .add_attribute("is_locked", is_locked.to_string())
    )
}

fn try_release(_info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    let mut is_locked = LOCKED.load(deps.storage)?;
    if !is_locked {
        return Err(ContractError::LockError { val: "Not locked".to_string() });
    }

    // transfer ownership and unlock
    let mut ownership = OWNERSHIP.load(deps.storage)?;
    ownership.owner = to;
    is_locked = false;

    OWNERSHIP.save(deps.storage, &ownership)?;
    LOCKED.save(deps.storage, &is_locked)?;

    Ok(Response::new()
        .add_attribute("method", "try_release")
        .add_attribute("is_locked", is_locked.to_string())
        .add_attribute("owner", ownership.owner.to_string())
    )
}

pub fn try_transfer(info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    let is_locked = LOCKED.load(deps.storage)?;
    if is_locked {
        return Err(ContractError::LockError {
            val: "Unable to transfer a locked ownable".to_string(),
        });
    }

    let network = NETWORK.load(deps.storage)?;
    let ownership = OWNERSHIP.update(deps.storage, |mut state| -> Result<_, ContractError> {
        if address_lto(network.id as char, info.sender.to_string())? != state.owner {
            return Err(ContractError::Unauthorized {
                val: "Unauthorized transfer attempt".to_string(),
            });
        }
        state.owner = to.clone();
        Ok(state)
    })?;
    Ok(Response::new()
        .add_attribute("method", "try_transfer")
        .add_attribute("new_owner", ownership.owner.to_string())
    )
}

pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetOwnableConfig {} => query_ownable_config(deps),
        QueryMsg::GetOwnableMetadata {} => query_ownable_metadata(deps),
        QueryMsg::GetOwnership {} => query_ownable_ownership(deps),
        QueryMsg::IsLocked {} => query_lock_state(deps),
    }
}

fn query_ownable_ownership(deps: Deps) -> StdResult<Binary> {
    let ownership = OWNERSHIP.load(deps.storage)?;
    to_binary(&ownership)
}

fn query_lock_state(deps: Deps) -> StdResult<Binary> {
    let is_locked = LOCKED.load(deps.storage)?;
    to_binary(&is_locked)
}

fn query_ownable_config(deps: Deps) -> StdResult<Binary> {
    let config = CONFIG.load(deps.storage)?;
    let resp = OwnableStateResponse {
        consumed_ownable_ids: config.consumed_ownable_ids,
        color: config.color,
        has_antenna: config.has_antenna,
        has_speaker: config.has_speaker,
        has_armor: config.has_armor,
    };
    to_binary(&resp)
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