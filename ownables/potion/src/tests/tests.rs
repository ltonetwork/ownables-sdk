use std::collections::HashMap;
use std::marker::PhantomData;
use cosmwasm_std::testing::{mock_env, mock_info};
use cosmwasm_std::{OwnedDeps, MemoryStorage, Response, MessageInfo, Addr, Binary, from_binary, Uint128};
use crate::{create_lto_env, ExecuteMsg, instantiate, InstantiateMsg};
use crate::contract::{execute, query, register_external_event};
use crate::error::ContractError;
use crate::msg::{ExternalEvent, OwnershipResponse, QueryMsg};
use crate::state::NFT;
use crate::utils::{EmptyApi, EmptyQuerier};

const LTO_USER: &str = "2bJ69cFXzS8AJTcCmzjc9oeHZmBrmMVUr8svJ1mTGpho9izYrbZjrMr9q1YwvY";
const PUBLIC_KEY: &str = "v3KjemAaDRYztCiwdT9X72waHdpTq6tHBxyqqCBfFCf7";
const LTO_PUBLIC_KEY_ALT: &str = "GjSbdB6a5DFNEHjDSmn724QsrRStKYzkahPH67wyrhAY";
const LTO_ADDRESS: &str = "3NBd71MErsjwmStnj8PQECHP1JL2jvuY2HW";

struct CommonTest {
    deps: OwnedDeps<MemoryStorage, EmptyApi, EmptyQuerier>,
    info: MessageInfo,
    res: Response,
}
fn setup_test(network: String) -> CommonTest {
    let mut deps = OwnedDeps {
        storage: MemoryStorage::default(),
        api: EmptyApi::default(),
        querier: EmptyQuerier::default(),
        custom_query_type: PhantomData,
    };
    let info = mock_info(PUBLIC_KEY, &[]);
    let nft = NFT {
        nft_id: Uint128::one(),
        network: network.to_string(),
        nft_contract_address: "nft-contract-address".to_string(),
    };
    let msg = InstantiateMsg {
        ownable_id: "2bJ69cFXzS8AJTcCmzjc9oeHZmBrmMVUr8svJ1mTGpho9izYrbZjrMr9q1YwvY".to_string(),
        nft,
        network_id: 84,
        image: None,
        image_data: None,
        external_url: None,
        description: Some("Drink a colorful potion".to_string()),
        name: Some("Potion".to_string()),
        background_color: None,
        animation_url: None,
        youtube_url: None,
    };

    let res: Response = instantiate(
        deps.as_mut(),
        mock_env(),
        info.clone(),
        msg
    ).unwrap();

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
    } = setup_test("eip155:1".to_string());

    assert_eq!(0, res.messages.len());
    assert_eq!(res.attributes.get(0).unwrap().value, "instantiate".to_string());
    assert_eq!(res.attributes.get(1).unwrap().value, PUBLIC_KEY.to_string());
    assert_eq!(res.attributes.get(2).unwrap().value, PUBLIC_KEY.to_string());
    assert!(res.attributes.get(3).unwrap().value.starts_with("#"));
    assert_eq!(res.attributes.get(3).unwrap().value.len(), 7);
    assert_eq!(res.attributes.get(4).unwrap().value, "100".to_string());
}

#[test]
fn test_drink() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());
    let deps = deps.as_mut();

    let msg = ExecuteMsg::Consume { amount: 50 };
    let res: Response = execute(deps, mock_env(), info, msg).unwrap();

    assert_eq!(0, res.messages.len());
    assert_eq!(res.attributes.get(0).unwrap().value, "try_drink".to_string());
    assert_eq!(res.attributes.get(1).unwrap().value, "50".to_string());
}

#[test]
fn test_drink_unauthorized() {
    let CommonTest {
        mut deps,
        mut info,
        res: _,
    } = setup_test("eip155:1".to_string());
    let deps = deps.as_mut();
    info.sender = Addr::unchecked("not-the-owner".to_string());
    let msg = ExecuteMsg::Consume { amount: 50 };

    let err: ContractError = execute(deps, mock_env(), info, msg)
        .unwrap_err();

    let _expected_err = ContractError::Unauthorized {
        val: "Unable to drink potion".to_string(),
    };
    assert!(matches!(err, _expected_err));
}

#[test]
fn test_drink_locked() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    // lock the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Lock {},
    ).unwrap();

    // attempt to drink a locked ownable
    let err = execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info(LTO_USER, &[]),
        ExecuteMsg::Consume {
            amount: 10,
        },
    ).unwrap_err();

    assert!(matches!(err, ContractError::LockError { .. }));
}

#[test]
fn test_drink_too_much() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());
    let deps = deps.as_mut();
    let msg = ExecuteMsg::Consume { amount: 150 };

    let err: ContractError = execute(deps, mock_env(), info, msg)
        .unwrap_err();

    let _expected_err_val = "attempt to drink more than possible".to_string();
    assert!(matches!(err, ContractError::CustomError { val: _expected_err_val }));
}

#[test]
fn test_transfer() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());
    let deps = deps.as_mut();

    let msg = ExecuteMsg::Transfer { to: Addr::unchecked("other-owner-1") };

    let res: Response = execute(deps, mock_env(), info, msg).unwrap();

    assert_eq!(res.attributes.get(0).unwrap().value, "try_transfer".to_string());
    assert_eq!(res.attributes.get(1).unwrap().value, "other-owner-1".to_string());
}

#[test]
fn test_transfer_locked() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    // lock the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Lock {},
    ).unwrap();

    // attempt to transfer a locked ownable
    let err = execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info("sender-1", &[]),
        ExecuteMsg::Transfer {
            to: Addr::unchecked(LTO_USER)
        },
    ).unwrap_err();

    assert!(matches!(err, ContractError::LockError { .. }));
}

#[test]
fn test_transfer_unauthorized() {
    let CommonTest {
        mut deps,
        mut info,
        res: _,
    } = setup_test("eip155:1".to_string());
    let deps = deps.as_mut();
    info.sender = Addr::unchecked("not-the-owner".to_string());
    let msg = ExecuteMsg::Transfer { to: Addr::unchecked("not-the-owner") };

    let err: ContractError = execute(deps, mock_env(), info, msg)
        .unwrap_err();

    let _expected_err = ContractError::Unauthorized {
        val: "Unauthorized transfer attempt".to_string(),
    };
    assert!(matches!(err, _expected_err));
}

#[test]
fn test_query_config() {
    let CommonTest {
        deps,
        info: _,
        res: _,
    } = setup_test("eip155:1".to_string());

    let msg = QueryMsg::GetOwnableConfig {};
    let resp: Binary = query(deps.as_ref(), create_lto_env(), msg).unwrap();
    let json: String = "{\"current_amount\":100,\"max_capacity\":100,\"color\":\"#11D539\"}".to_string();
    let expected_binary = Binary::from(json.as_bytes());

    assert_eq!(resp, expected_binary);
}

#[test]
fn test_query_ownership() {
    let CommonTest {
        deps,
        info: _,
        res: _,
    } = setup_test("eip155:1".to_string());

    let msg = QueryMsg::GetOwnership {};
    let resp: Binary = query(deps.as_ref(), create_lto_env(), msg).unwrap();
    let json: String = "{\"owner\":\"3NBd71MErsjwmStnj8PQECHP1JL2jvuY2HW\",\"issuer\":\"3NBd71MErsjwmStnj8PQECHP1JL2jvuY2HW\"}".to_string();
    let expected_binary = Binary::from(json.as_bytes());

    assert_eq!(resp, expected_binary);
}

#[test]
fn test_query_metadata() {
    let CommonTest {
        deps,
        info: _,
        res: _,
    } = setup_test("eip155:1".to_string());

    let msg = QueryMsg::GetOwnableMetadata {};
    let resp: Binary = query(deps.as_ref(), create_lto_env(), msg).unwrap();
    let json: String = "{\"image\":null,\"image_data\":null,\"external_url\":null,\"description\":\"Ownable potion that can be drinkd\",\"name\":\"Potion\",\"background_color\":null,\"animation_url\":null,\"youtube_url\":null}".to_string();
    let expected_binary = Binary::from(json.as_bytes());

    assert_eq!(resp, expected_binary);
}

#[test]
fn test_lock() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    // lock the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info,
        ExecuteMsg::Lock {},
    ).unwrap();

    let resp = query(
        deps.as_ref(),
        create_lto_env(),
        QueryMsg::IsLocked {}
    ).unwrap();

    let is_locked: bool = from_binary(&resp).unwrap();
    assert!(is_locked);
}

#[test]
fn test_lock_unauthorized() {
    let CommonTest {
        mut deps,
        info: _,
        res: _,
    } = setup_test("eip155:1".to_string());

    // attempt to lock the ownable
    let err = execute(
        deps.as_mut(),
        create_lto_env(),
        mock_info(LTO_PUBLIC_KEY_ALT, &[]),
        ExecuteMsg::Lock {},
    ).unwrap_err();

    let _expected_err = ContractError::Unauthorized {
        val: "Unauthorized".to_string(),
    };
    assert!(matches!(err, _expected_err));
}

#[test]
fn test_lock_already_locked() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    // lock the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Lock {},
    ).unwrap();

    // attempt to lock the ownable again
    let err: ContractError = execute(
        deps.as_mut(),
        create_lto_env(),
        info,
        ExecuteMsg::Lock {},
    ).unwrap_err();

    assert!(matches!(err, ContractError::LockError { .. }));
}

#[test]
fn test_register_external_event_unknown_type() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    let event = ExternalEvent {
        chain_id: "eip155:1".to_string(),
        event_type: "<3".to_string(),
        args: HashMap::new(),
    };

    // lock the ownable
    let err: ContractError = register_external_event(
        info.clone(),
        deps.as_mut(),
        event,
    ).unwrap_err();

    assert!(matches!(err, ContractError::MatchEventError { .. }));
}

#[test]
fn test_register_external_event_invalid_args() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    let mut args = HashMap::new();
    args.insert("key".to_string(), "val".to_string());
    args.insert("key1".to_string(), "val1".to_string());
    args.insert("key2".to_string(), "val2".to_string());

    let event = ExternalEvent {
        chain_id: "eip155:1".to_string(),
        event_type: "lock".to_string(),
        args,
    };

    let err: ContractError = register_external_event(
        info.clone(),
        deps.as_mut(),
        event,
    ).unwrap_err();

    assert!(matches!(err, ContractError::InvalidExternalEventArgs { .. }));
}

#[test]
fn test_register_external_lock_event_unknown_chain_id() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    let mut args = HashMap::new();
    args.insert("owner".to_string(), "val".to_string());
    args.insert("token_id".to_string(), "1".to_string());
    args.insert("source_contract".to_string(), "nft_contract".to_string());

    let event = ExternalEvent {
        chain_id: "wrongid:1".to_string(),
        event_type: "lock".to_string(),
        args,
    };

    let err: ContractError = register_external_event(
        info.clone(),
        deps.as_mut(),
        event,
    ).unwrap_err();

    let _expected_err = ContractError::LockError {
        val: "network mismatch".to_string(),
    };

    assert!(matches!(err, _expected_err));
}

#[test]
fn test_release_ownable_lto_address() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    // lock the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Lock {},
    ).unwrap();

    let mut args: HashMap<String, String> = HashMap::new();
    args.insert("owner".to_string(), PUBLIC_KEY.to_string());
    args.insert("token_id".to_string(), "1".to_string());
    args.insert("contract".to_string(), "nft-contract-address".to_string());

    let lock_event = ExternalEvent {
        chain_id: "eip155:1".to_string(),
        event_type: "lock".to_string(),
        args,
    };

    // ownable should be claimed to eip155:1 representation of the public key
    register_external_event(
        mock_info(PUBLIC_KEY, &[]),
        deps.as_mut(),
        lock_event,
    ).unwrap();

    let resp = query(
        deps.as_ref(),
        create_lto_env(),
        QueryMsg::GetOwnership {},
    ).unwrap();

    // validate that the owner is eip155:1 representation of pub key used
    // to register the external event
    let ownership_config: OwnershipResponse = from_binary(&resp).unwrap();
    assert_eq!(ownership_config.owner, LTO_ADDRESS);

    let resp = query(
        deps.as_ref(),
        create_lto_env(),
        QueryMsg::IsLocked {},
    ).unwrap();
    // validate that ownable is no longer locked
    let is_locked: bool = from_binary(&resp).unwrap();
    assert!(!is_locked);

}

#[test]
fn test_release_unauthorized() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    // lock the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Lock {},
    ).unwrap();
}

#[test]
fn test_release_ownable_eth_address() {
    let CommonTest {
        mut deps,
        info,
        res: _,
    } = setup_test("eip155:1".to_string());

    // lock the ownable
    execute(
        deps.as_mut(),
        create_lto_env(),
        info.clone(),
        ExecuteMsg::Lock {},
    ).unwrap();

    let mut args: HashMap<String, String> = HashMap::new();
    args.insert("owner".to_string(), PUBLIC_KEY.to_string());
    args.insert("token_id".to_string(), "1".to_string());
    args.insert("contract".to_string(), "nft-contract-address".to_string());

    let lock_event = ExternalEvent {
        chain_id: "eip155:1".to_string(),
        event_type: "lock".to_string(),
        args,
    };

    // ownable should be claimed to eip155:1 representation of the public key
    register_external_event(
        mock_info(PUBLIC_KEY, &[]),
        deps.as_mut(),
        lock_event,
    ).unwrap();

    let resp = query(
        deps.as_ref(),
        create_lto_env(),
        QueryMsg::GetOwnership {},
    ).unwrap();
    // validate that the owner is eip155:1 representation of pub key used
    // to register the external event
    let ownership_config: OwnershipResponse = from_binary(&resp).unwrap();
    assert_eq!(ownership_config.owner, LTO_ADDRESS);

    let resp = query(
        deps.as_ref(),
        create_lto_env(),
        QueryMsg::IsLocked {},
    ).unwrap();
    // validate that ownable is no longer locked
    let is_locked: bool = from_binary(&resp).unwrap();
    assert!(!is_locked);
}
