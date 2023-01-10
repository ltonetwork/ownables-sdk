use std::marker::PhantomData;
use cosmwasm_std::testing::{mock_env, mock_info};
use cosmwasm_std::{OwnedDeps, MemoryStorage, Response, MessageInfo, Addr, Binary, to_binary, from_binary};
use crate::{create_lto_env, ExecuteMsg, instantiate, InstantiateMsg};
use crate::contract::{execute, query};
use crate::error::ContractError;
use crate::msg::{OwnableStateResponse, QueryMsg};
use crate::utils::{EmptyApi, EmptyQuerier};

const LTO_USER: &str = "2bJ69cFXzS8AJTcCmzjc9oeHZmBrmMVUr8svJ1mTGpho9izYrbZjrMr9q1YwvY";

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
fn test_consume_bridged() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    let bridge_addr = Addr::unchecked("bridge_address".to_string());
    // set the bridge
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::SetBridge {
            bridge: Some(bridge_addr.clone())
        },
    ).unwrap();

    // bridge the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Bridge {},
    ).unwrap();

    // attempt to consume a bridged ownable
    let err = execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info("bridge_address", &[]),
        ExecuteMsg::Consume {
            amount: 10,
        },
    ).unwrap_err();

    assert!(matches!(err, ContractError::BridgeError { .. }));
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
fn test_transfer_bridged() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    let bridge_addr = Addr::unchecked("bridge_address".to_string());
    // set the bridge
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::SetBridge {
            bridge: Some(bridge_addr.clone())
        },
    ).unwrap();

    // bridge the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Bridge {},
    ).unwrap();

    // attempt to transfer a bridged ownable
    let err = execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info("bridge_address", &[]),
        ExecuteMsg::Transfer {
            to: Addr::unchecked(LTO_USER)
        },
    ).unwrap_err();

    assert!(matches!(err, ContractError::BridgeError { .. }));
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
    let resp: Binary = query(deps.as_ref(), create_lto_env(), msg).unwrap();
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
    let resp: Binary = query(deps.as_ref(), create_lto_env(), msg).unwrap();
    let json: String = "{\"image\":null,\"image_data\":null,\"external_url\":null,\"description\":\"Ownable potion that can be consumed\",\"name\":\"Potion\",\"background_color\":null,\"animation_url\":null,\"youtube_url\":null}".to_string();
    let expected_binary = Binary::from(json.as_bytes());

    assert_eq!(resp, expected_binary);
}

#[test]
fn test_set_bridge() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    let bridge_addr = Addr::unchecked("bridge_address".to_string());

    let msg = ExecuteMsg::SetBridge {
        bridge: Some(bridge_addr.clone())
    };
     execute(
         deps.as_mut(),
         create_lto_env(),
         info.clone(),
         msg
     ).unwrap();

    let resp = query(
        deps.as_ref(),
        create_lto_env(),
        QueryMsg::GetBridgeAddress {},
    );
    assert_eq!(resp, to_binary(&bridge_addr));
}

#[test]
fn test_set_bridge_unauthorized() {
    let CommonTest {
        mut deps,
        info: _,
        res: _,
    } = setup_test();

    let bridge_addr = Addr::unchecked("bridge_address".to_string());
    let msg = ExecuteMsg::SetBridge {
        bridge: Some(bridge_addr.clone())
    };
    let err: ContractError = execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info("unauthorized_sender", &[]),
        msg
    ).unwrap_err();

    assert!(matches!(err, ContractError::Unauthorized { .. }));
}

#[test]
fn test_set_bridge_on_bridged_ownable() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    let bridge_addr = Addr::unchecked("bridge_address".to_string());
    // set the bridge
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::SetBridge {
            bridge: Some(bridge_addr.clone())
        },
    ).unwrap();

    // bridge the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Bridge {},
    ).unwrap();

    // attempt to set the bridge address
    let err = execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info(bridge_addr.as_str(), &[]),
        ExecuteMsg::SetBridge {
            bridge: Some(bridge_addr.clone())
        },
    ).unwrap_err();

    assert!(matches!(err, ContractError::BridgeError { .. }));
}

#[test]
fn test_bridge() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    let bridge_addr = Addr::unchecked("bridge_address".to_string());
    // set the bridge
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::SetBridge {
            bridge: Some(bridge_addr.clone())
        },
    ).unwrap();

    // bridge the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info,
        ExecuteMsg::Bridge {},
    ).unwrap();

    let resp = query(
        deps.as_ref(),
        create_lto_env(),
        QueryMsg::GetOwnableConfig {}
    ).unwrap();

    let response: OwnableStateResponse = from_binary(&resp).unwrap();
    // assert bridge owns the ownable
    assert_eq!(bridge_addr.to_string(), response.owner);
}

#[test]
fn test_bridge_unauthorized() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    let bridge_addr = Addr::unchecked("bridge_address".to_string());
    // set the bridge
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::SetBridge {
            bridge: Some(bridge_addr.clone())
        },
    ).unwrap();

    // attempt to bridge the ownable
    let err = execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info("unauthorized", &[]),
        ExecuteMsg::Bridge {},
    ).unwrap_err();

    assert!(matches!(err, ContractError::Unauthorized { .. }));
}

#[test]
fn test_bridge_no_bridge_set() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    // attempt to bridge the ownable
    let err = execute(
        deps.as_mut(),
        create_lto_env(),
        info,
        ExecuteMsg::Bridge {},
    ).unwrap_err();

    assert!(matches!(err, ContractError::BridgeError { .. }));
}

#[test]
fn test_release() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    let bridge_addr = Addr::unchecked("bridge_address".to_string());
    // set the bridge
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::SetBridge {
            bridge: Some(bridge_addr.clone())
        },
    ).unwrap();

    // bridge the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Bridge {},
    ).unwrap();

    let resp = query(
        deps.as_ref(),
        create_lto_env(),
        QueryMsg::GetOwnableConfig {}
    ).unwrap();

    let response: OwnableStateResponse = from_binary(&resp).unwrap();
    // assert bridge owns the ownable
    assert_eq!(bridge_addr.to_string(), response.owner);

    // release the ownable to a new owner
    execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info(bridge_addr.as_str(), &[]),
        ExecuteMsg::Release { to: Addr::unchecked("new_owner") },
    ).unwrap();

    let resp = query(
        deps.as_ref(),
        create_lto_env(),
        QueryMsg::GetOwnableConfig {}
    ).unwrap();

    let response: OwnableStateResponse = from_binary(&resp).unwrap();
    // assert new owner owns the ownable
    assert_eq!("new_owner".to_string(), response.owner);
}



#[test]
fn test_release_unauthorized() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    let bridge_addr = Addr::unchecked("bridge_address".to_string());
    // set the bridge
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::SetBridge {
            bridge: Some(bridge_addr.clone())
        },
    ).unwrap();

    // bridge the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Bridge {},
    ).unwrap();

    // release the ownable to a new owner as the new owner
    let err = execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info("new_owner", &[]),
        ExecuteMsg::Release { to: Addr::unchecked("new_owner") },
    ).unwrap_err();

    assert!(matches!(err, ContractError::Unauthorized { .. }));
}

