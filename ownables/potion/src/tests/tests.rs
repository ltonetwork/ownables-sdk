use std::collections::HashMap;
use std::marker::PhantomData;
use cosmwasm_std::testing::{mock_env, mock_info};
use cosmwasm_std::{OwnedDeps, MemoryStorage, Response, MessageInfo, Addr, Binary, from_binary};
use crate::{create_lto_env, ExecuteMsg, instantiate, InstantiateMsg};
use crate::contract::{execute, query};
use crate::error::ContractError;
use crate::msg::{ExternalEvent, OwnableStateResponse, QueryMsg};
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
        youtube_url: None,
        network_id: 'T'
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
fn test_bridge() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

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
    println!("{:?}" , response);
}

#[test]
fn test_bridge_unauthorized() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

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
        QueryMsg::IsBridged {}
    ).unwrap();

    let locked_state: bool = from_binary(&resp).unwrap();
    // assert ownable is locked
    assert!(locked_state);

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
fn test_register_external_event_unknown_type() {
    unimplemented!()
}

#[test]
fn test_register_external_event_invalid_args() {
    unimplemented!()
}

#[test]
fn test_register_lock_event_unknown_chain_id() {
    unimplemented!()
}

#[test]
fn test_release_ownable_lto_address() {
    unimplemented!()
}

#[test]
fn test_release_ownable_eth_address() {
    unimplemented!()
}

#[test]
fn test_release_unauthorized() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

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

#[test]
fn test_register_lock_external_event() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test();

    // bridge the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Bridge {},
    ).unwrap();

    let eth_public_key = "0x04e71a3edcf033799698c988125fcd4ff49e6eb3e944d8b595da98fa5e7f4b9a34f1c40b96d736d17910f9cd6225fae3af63c0d451f9977a463b04df2f45ceb917";

    let info = MessageInfo {
        sender: Addr::unchecked(eth_public_key),
        funds: vec![],
    };

    let mut args: HashMap<String, String> = HashMap::new();
    args.insert("token_id".to_string(), "ownable_1".to_string());
    args.insert("owner".to_string(), eth_public_key.to_string());

    let lock_event = ExternalEvent {
        chain_id: "eip155:1".to_string(),
        event_type: "lock".to_string(),
        args,
    };

    // ownable should become claimable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info,
        ExecuteMsg::RegisterExternalEvent { event: lock_event, },
    ).unwrap();


    execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info("new_owner", &[]),
        ExecuteMsg::Release { to: Addr::unchecked("new_owner") },
    ).unwrap_err();
}
