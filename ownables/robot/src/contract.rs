use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use crate::state::{NFT_ITEM, Config, CONFIG, METADATA, LOCKED, PACKAGE_CID, OWNABLE_INFO, NETWORK_ID};
use cosmwasm_std::{to_binary, Binary};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cw2::set_contract_version;
use ownable_std::{address_eip155, address_lto, ExternalEventMsg, InfoResponse, Metadata, OwnableInfo};
use crate::error::ContractError;

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

    let derived_addr = address_lto(
        msg.network_id as char,
        info.sender.to_string()
    )?;

    let ownable_info = OwnableInfo {
        owner: derived_addr.clone(),
        issuer: derived_addr.clone(),
        ownable_type: msg.ownable_type.clone(),
    };

    let config = Config {
        consumed_ownable_ids: vec![],
        color: rgb_hex(25, 82, 114),
        has_antenna: false,
        has_speaker: false,
        has_armor: false
    };

    let meta = Metadata {
        image: None,
        image_data: None,
        external_url: None,
        description: Some("An adorable robot companion! He's great at just hanging out and keeping you company. Add-ons are available as Consumables.".to_string()),
        name: Some("Robot".to_string()),
        background_color: None,
        animation_url: None,
        youtube_url: None,
    };

    NETWORK_ID.save(deps.storage, &msg.network_id)?;
    CONFIG.save(deps.storage, &Some(config.clone()))?;
    if let Some(nft) = msg.nft {
        NFT_ITEM.save(deps.storage, &nft)?;
    }
    METADATA.save(deps.storage, &meta)?;
    LOCKED.save(deps.storage, &false)?;
    OWNABLE_INFO.save(deps.storage, &ownable_info)?;
    PACKAGE_CID.save(deps.storage, &msg.package)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", info.clone().sender.to_string())
        .add_attribute("issuer", info.sender.to_string())
        .add_attribute("color", config.color)
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
        _ => Err(ContractError::NotImplemented {}),
    }
}

pub fn register_external_event(
    info: MessageInfo,
    deps: DepsMut,
    event: ExternalEventMsg,
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
    event: ExternalEventMsg,
    ownable_id: String,
) -> Result<Response, ContractError> {

    let owner = event.attributes.get("owner")
        .cloned()
        .unwrap_or_default();
    let consumed_by = event.attributes.get("consumed_by")
        .cloned()
        .unwrap_or_default();
    let issuer = event.attributes.get("issuer")
        .cloned()
        .unwrap_or_default();
    let color = event.attributes.get("color")
        .cloned()
        .unwrap_or_default();
    let consumable_type = event.attributes.get("consumable_type")
        .cloned()
        .unwrap_or_default();

    if consumable_type == "paint" {
        if color.is_empty() {
            return Err(ContractError::InvalidExternalEventArgs {});
        }
    }
    if consumable_type.is_empty() || issuer.is_empty() || consumed_by.is_empty() || owner.is_empty() {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    let ownership = OWNABLE_INFO.load(deps.storage)?;

    // validate issuer of collection matches
    if ownership.issuer.to_string() != issuer {
        return Err(ContractError::InvalidExternalEventArgs {})
    }

    let mut config_option = CONFIG.load(deps.storage)?;
    if let Some(mut config) = config_option {
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
            "speakers" => {
                config.has_speaker = true;
            },
            _ => {},
        }
        config.consumed_ownable_ids.push(Addr::unchecked(ownable_id));
        CONFIG.save(deps.storage, &Some(config))?;
    }

    Ok(Response::new()
        .add_attribute("method", "try_register_consume")
        .add_attribute("status", "success")
    )
}

fn try_register_lock(
    info: MessageInfo,
    deps: DepsMut,
    event: ExternalEventMsg,
) -> Result<Response, ContractError> {
    let owner = event.attributes.get("owner")
        .cloned()
        .unwrap_or_default();
    let nft_id = event.attributes.get("token_id")
        .cloned()
        .unwrap_or_default();
    let contract_addr = event.attributes.get("contract")
        .cloned()
        .unwrap_or_default();

    if owner.is_empty() || nft_id.is_empty() || contract_addr.is_empty() {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    let nft = NFT_ITEM.load(deps.storage).unwrap();
    if nft.id.to_string() != nft_id {
        return Err(ContractError::LockError {
            val: "nft_id mismatch".to_string()
        });
    } else if nft.address != contract_addr {
        return Err(ContractError::LockError {
            val: "locking contract mismatch".to_string()
        });
    }

    let event_network = event.network.unwrap_or("".to_string());
    if event_network == "" {
        return Err(ContractError::MatchChainIdError { val: "No network".to_string() })
    } else if event_network != nft.network {
        return Err(ContractError::LockError {
            val: "network mismatch".to_string()
        });
    }

    let caip_2_fields: Vec<&str> = event_network.split(":").collect();
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

            let network_id = NETWORK_ID.load(deps.storage)?;
            let address = address_lto(network_id as char, owner)?;
            Ok(try_release(info, deps, address)?)
        }
        _ => return Err(ContractError::MatchChainIdError { val: event_network }),
    }
}

pub fn try_lock(info: MessageInfo, deps: DepsMut) -> Result<Response, ContractError> {
    // only ownable owner can lock it
    let ownership = OWNABLE_INFO.load(deps.storage)?;
    let network = NETWORK_ID.load(deps.storage)?;
    let network_id = network as char;
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
    let mut ownership = OWNABLE_INFO.load(deps.storage)?;
    ownership.owner = to;
    is_locked = false;

    OWNABLE_INFO.save(deps.storage, &ownership)?;
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
    let network_id = NETWORK_ID.load(deps.storage)?;
    let derived_addr = address_lto(
        network_id as char,
        info.sender.to_string()
    )?;
    let ownership = OWNABLE_INFO.update(deps.storage, |mut config| -> Result<_, ContractError> {
        if derived_addr != config.owner {
            return Err(ContractError::Unauthorized {
                val: "Unauthorized transfer attempt".to_string(),
            });
        }
        config.owner = to.clone();
        Ok(config)
    })?;
    Ok(Response::new()
        .add_attribute("method", "try_transfer")
        .add_attribute("new_owner", ownership.owner.to_string())
    )
}

pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetInfo {} => query_ownable_info(deps),
        QueryMsg::GetMetadata {} => query_ownable_metadata(deps),
        QueryMsg::GetWidgetState {} => query_ownable_widget_state(deps),
        QueryMsg::IsLocked {} => query_lock_state(deps),
        QueryMsg::IsConsumerOf {
            issuer,
            consumable_type
        } => query_is_consumer_of(deps, issuer, consumable_type),
    }
}

fn query_is_consumer_of(deps: Deps, issuer: Addr, consumable_type: String) -> StdResult<Binary> {
    let ownable_info = OWNABLE_INFO.load(deps.storage)?;
    if let Some(ownable_type) = ownable_info.ownable_type {
        let valid = (issuer == ownable_info.issuer) && (ownable_type == consumable_type);
        return to_binary(&valid);
    };
    to_binary(&false)
}

fn query_ownable_widget_state(deps: Deps) -> StdResult<Binary> {
    let widget_config = CONFIG.load(deps.storage)?;
    to_binary(&widget_config)
}

fn query_lock_state(deps: Deps) -> StdResult<Binary> {
    let is_locked = LOCKED.load(deps.storage)?;
    to_binary(&is_locked)
}

fn query_ownable_info(deps: Deps) -> StdResult<Binary> {
    let nft = NFT_ITEM.may_load(deps.storage)?;
    let ownable_info = OWNABLE_INFO.load(deps.storage)?;
    to_binary(&InfoResponse {
        owner: ownable_info.owner,
        issuer: ownable_info.issuer,
        nft,
        ownable_type: ownable_info.ownable_type,
    })
}

fn query_ownable_metadata(deps: Deps) -> StdResult<Binary> {
    let meta = METADATA.load(deps.storage)?;
    to_binary(&meta)
}
