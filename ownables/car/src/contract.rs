use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, Metadata, InfoResponse, QueryMsg};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Binary, StdError, to_binary};
use cw2::set_contract_version;
use crate::ExternalEventMsg;
use crate::state::{Config, CONFIG, Cw721, CW721, LOCKED, NETWORK_ID, NFT, OWNABLE_INFO, OwnableInfo, PACKAGE_CID};
use crate::utils::{address_eip155, address_lto};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:ownable-car-demo";
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
        ownable_type: msg.ownable_type,
    };

    let cw721 = Cw721 {
        image: None,
        image_data: None,
        external_url: None,
        description: Some("Ownable car".to_string()),
        name: Some("Car".to_string()),
        background_color: None,
        animation_url: None,
        youtube_url: None
    };

    NETWORK_ID.save(deps.storage, &msg.network_id)?;
    CONFIG.save(deps.storage, &None)?;
    if let Some(nft) = msg.nft {
        NFT.save(deps.storage, &nft)?;
    }
    CW721.save(deps.storage, &cw721)?;
    LOCKED.save(deps.storage, &false)?;
    OWNABLE_INFO.save(deps.storage, &ownable_info)?;
    PACKAGE_CID.save(deps.storage, &msg.package)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", derived_addr.clone())
        .add_attribute("issuer", derived_addr.clone()))
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

pub fn register_external_event(
    info: MessageInfo,
    deps: DepsMut,
    event: ExternalEventMsg,
    _ownable_id: String,
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
        _ => return Err(ContractError::MatchEventError { val: event.event_type }),
    };

    Ok(response)
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

fn try_register_lock(
    info: MessageInfo,
    deps: DepsMut,
    event: ExternalEventMsg,
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
    if nft.id.to_string() != nft_id {
        return Err(ContractError::LockError {
            val: "nft_id mismatch".to_string()
        });
    } else if nft.address != contract_addr {
        return Err(ContractError::LockError {
            val: "locking contract mismatch".to_string()
        });
    } else if event.chain_id != nft.network {
        return Err(ContractError::LockError {
            val: "network mismatch".to_string()
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

            let network_id = NETWORK_ID.load(deps.storage)?;
            let address = address_lto(network_id as char, owner)?;
            Ok(try_release(info, deps, address)?)
        }
        _ => return Err(ContractError::MatchChainIdError { val: event.chain_id }),
    }
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

fn query_ownable_widget_state(deps: Deps) -> StdResult<Binary> {
    let widget_config = CONFIG.load(deps.storage)?;
    to_binary(&widget_config)
}

fn query_lock_state(deps: Deps) -> StdResult<Binary> {
    let is_locked = LOCKED.load(deps.storage)?;
    to_binary(&is_locked)
}

fn query_is_consumer_of(deps: Deps, issuer: Addr, consumable_type: String) -> StdResult<Binary> {
    // basic ownable with no consumption functionality
    to_binary(&false)
}

fn query_ownable_info(deps: Deps) -> StdResult<Binary> {
    let nft = NFT.may_load(deps.storage)?;
    let ownable_info = OWNABLE_INFO.load(deps.storage)?;
    to_binary(&InfoResponse {
        owner: ownable_info.owner,
        issuer: ownable_info.issuer,
        nft,
        ownable_type: ownable_info.ownable_type,
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


#[cfg(test)]
mod tests {
    use std::marker::PhantomData;
    use super::*;
    use cosmwasm_std::{Addr, MemoryStorage, MessageInfo, OwnedDeps, Response};
    use cosmwasm_std::testing::{mock_env, mock_info};
    use crate::utils::{EmptyApi, EmptyQuerier};

    // struct CommonTest {
    //     deps: OwnedDeps<MemoryStorage, EmptyApi, EmptyQuerier>,
    //     info: MessageInfo,
    //     res: Response,
    // }
    // fn setup_test() -> CommonTest {
    //     let mut deps = OwnedDeps {
    //         storage: MemoryStorage::default(),
    //         api: EmptyApi::default(),
    //         querier: EmptyQuerier::default(),
    //         custom_query_type: PhantomData,
    //     };
    //     let info = mock_info("sender-1", &[]);
    //
    //     let msg = InstantiateMsg {
    //         ownable_id: "2bJ69cFXzS8AJTcCmzjc9oeHZmBrmMVUr8svJ1mTGpho9izYrbZjrMr9q1YwvY".to_string(),
    //         // image: None,
    //         // image_data: None,
    //         // external_url: None,
    //         // description: Some("visual car ownable".to_string()),
    //         // name: Some("Car".to_string()),
    //         // background_color: None,
    //         // animation_url: None,
    //         // youtube_url: None
    //         package: "".to_string(),
    //         nft: None,
    //         ownable_type: None,
    //         network_id: ''
    //     };
    //
    //     let res: Response = instantiate(deps.as_mut(), mock_env(), info.clone(), msg).unwrap();
    //
    //     CommonTest {
    //         deps,
    //         info,
    //         res,
    //     }
    // }
    //
    // #[test]
    // fn test_initialize() {
    //
    //     let CommonTest {
    //         deps: _,
    //         info: _,
    //         res,
    //     } = setup_test();
    //
    //     assert_eq!(0, res.messages.len());
    //     assert_eq!(res.attributes.get(0).unwrap().value, "instantiate".to_string());
    //     assert_eq!(res.attributes.get(1).unwrap().value, "sender-1".to_string());
    //     assert_eq!(res.attributes.get(2).unwrap().value, "sender-1".to_string());
    // }
    //
    // #[test]
    // fn test_transfer() {
    //     let CommonTest {
    //         mut deps,
    //         info,
    //         res: _,
    //     } = setup_test();
    //     let deps = deps.as_mut();
    //
    //     let msg = ExecuteMsg::Transfer { to: Addr::unchecked("other-owner-1") };
    //
    //     let res: Response = execute(deps, mock_env(), info, msg).unwrap();
    //
    //     assert_eq!(res.attributes.get(0).unwrap().value, "try_transfer".to_string());
    //     assert_eq!(res.attributes.get(1).unwrap().value, "other-owner-1".to_string());
    // }
    //
    // #[test]
    // fn test_transfer_unauthorized() {
    //     let CommonTest {
    //         mut deps,
    //         mut info,
    //         res: _,
    //     } = setup_test();
    //     let deps = deps.as_mut();
    //     info.sender = Addr::unchecked("not-the-owner".to_string());
    //     let msg = ExecuteMsg::Transfer { to: Addr::unchecked("not-the-owner") };
    //
    //     let err: ContractError = execute(deps, mock_env(), info, msg)
    //         .unwrap_err();
    //
    //     let _expected_err_val = "Unauthorized transfer attempt".to_string();
    //     assert!(matches!(err, ContractError::Unauthorized { val: _expected_err_val }));
    // }
    //
    // // #[test]
    // // fn test_query_config() {
    // //     let CommonTest {
    // //         deps,
    // //         info: _,
    // //         res: _,
    // //     } = setup_test();
    // //
    // //     let msg = QueryMsg::GetOwnableConfig {};
    // //     let resp: Binary = query(deps.as_ref(), msg).unwrap();
    // //     let json: String = "{\"owner\":\"sender-1\",\"issuer\":\"sender-1\"}".to_string();
    // //     let expected_binary = Binary::from(json.as_bytes());
    // //
    // //     assert_eq!(resp, expected_binary);
    // // }
    // //
    // // #[test]
    // // fn test_query_metadata() {
    // //     let CommonTest {
    // //         deps,
    // //         info: _,
    // //         res: _,
    // //     } = setup_test();
    // //
    // //     let msg = QueryMsg::GetOwnableMetadata {};
    // //     let resp: Binary = query(deps.as_ref(), msg).unwrap();
    // //     let json: String = "{\"image\":null,\"image_data\":null,\"external_url\":null,\"description\":\"Ownable car\",\"name\":\"Car\",\"background_color\":null,\"animation_url\":null,\"youtube_url\":null}".to_string();
    // //     let expected_binary = Binary::from(json.as_bytes());
    // //
    // //     assert_eq!(resp, expected_binary);
    // // }

}
