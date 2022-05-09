//! Test suite for the Web and headless browsers.
// #![cfg(target_arch = "wasm32")]


extern crate wasm_bindgen_test;

use std::{assert, panic};
use wasm_bindgen_test::*;
use cosmwasm_std::{ OwnedDeps, MessageInfo, Addr, Env ,from_slice};


// use lto_ownable_smartcontract::contract::execute;
use lto_ownable_smartcontract::msg::{ExecuteMsg, QueryMsg, InstantiateMsg};
use lto_ownable_smartcontract::state::State;
use lto_ownable_smartcontract::store::IdbStorage;
// use lto_ownable_smartcontract::*;
use lto_ownable_smartcontract::contract::*;
use lto_ownable_smartcontract::utils::{create_lto_deps, create_lto_env, EmptyApi, EmptyQuerier};


wasm_bindgen_test_configure!(run_in_browser);
/// ---------- TEST CONTRACT FROM BROWSER -------------
/// Execute
#[wasm_bindgen_test]
async fn execute_contract_no_initial_state() {

    let msg = ExecuteMsg::Increment { by: Some(1) };
    
    let (mut deps, info, env ) = prep_test_env().await;

    // execute contract with increment, Without a state present in the database: should panic!
    let res = execute(deps.as_mut(), env, info, msg);
    match res {
        Ok(_res) => panic!("The state should not be found."),
        Err(err) => {
            assert!(err.to_string() == "lto_ownable_smartcontract::state::State not found", "expected error 'lto_ownable_smartcontract::state::State not found'. got '{}'", &err.to_string())
        }
    }
}


// FIXME: tests without initial state get data from indexed db from other tests!!! 
#[wasm_bindgen_test]
async fn execute_contract_with_initial_state() {
    // TODO
}

/// Tests if the right error is thrown when we try to get a state without intializing it.
#[wasm_bindgen_test]
async fn query_state_no_initial_state() {
    let msg = QueryMsg::GetCount();

    let deps = create_lto_deps().await;

    // query contract with increment, Without a state present in the database: should panic!
    let res_state = query(deps.as_ref(), msg);
    match res_state {
        Ok(_res) => panic!("The state should not be found."),
        Err(err) => {
            assert!(err.to_string() == "lto_ownable_smartcontract::state::State not found", "expected error 'NotFound'. got {}", &err.to_string())
        }
    }
}

#[wasm_bindgen_test]
async fn query_state_with_initial_state() {
    // TODO
}

#[wasm_bindgen_test]
async fn instantiate_contract_test() {
    let msg = InstantiateMsg { count: 0 };
    let (mut deps, info, env ) = prep_test_env().await;

    let res = instantiate(deps.as_mut(), env, info, msg);    

    assert!(res.is_ok(), "Instantiate contract gives error {}", res.err().unwrap());
    let _responsee = res.unwrap();
}

#[wasm_bindgen_test]
async fn instantiate_contract_and_query(){
    let msg = InstantiateMsg { count: 0 };
    let (mut deps, info, env ) = prep_test_env().await;

    let _res = instantiate(deps.as_mut(), env, info, msg).unwrap();
    
    let q_res =     query(deps.as_ref(), QueryMsg::GetCount());
    assert!(q_res.is_ok(), "query contract after instantiate results in error : {}",q_res.err().unwrap());

    let count = q_res.unwrap();
    assert!(count.count == 0, "expected count to be '0', but was {} ", count.count)
}

/// Tests weather the contract fails when initialising the same intstance twice.
#[wasm_bindgen_test]
async fn instantiate_while_exists() {
    let msg = InstantiateMsg{count: 0 };

    let (mut deps, info, env) = prep_test_env().await;

    let _res = instantiate(deps.as_mut(), env.clone(), info.clone(), msg.clone());
    

    let _res = instantiate(deps.as_mut(), env, info, msg);
    // TODO: This should fail. Twice initialisation should be wrong. dunno how to though...
}

#[wasm_bindgen_test]
async fn instantiate_contract_and_execute() {
    let msg = InstantiateMsg { count: 0 };
    let (mut deps, info, env ) = prep_test_env().await;

    let _res = instantiate(deps.as_mut(), env.clone(), info.clone(), msg).unwrap();

    let execute_msg = ExecuteMsg::Increment { by: Some(1) };
    
    // execute increment by 1 and query 
    let _res = execute(deps.as_mut(), env.clone(), info.clone(), execute_msg.clone());
    let q_res =     query(deps.as_ref(), QueryMsg::GetCount());
    assert!(q_res.is_ok(), "query contract after instantiate results in error : {}",q_res.err().unwrap());

    let count = q_res.unwrap();
    assert!(count.count == 1, "expected count to be '0', but was {} ", count.count);

    //execute increment with same message state should have value 2 after second incement
    let _res = execute(deps.as_mut(), env, info, execute_msg);
    let q_res =     query(deps.as_ref(), QueryMsg::GetCount());
    assert!(q_res.is_ok(), "query contract after instantiate results in error : {}",q_res.err().unwrap());

    let count = q_res.unwrap();
    assert!(count.count == 2, "expected count to be '0', but was {} ", count.count);

    deps.storage.sync_to_db().await;

    let state_from_db_vec = deps.storage.get_item(b"state").await;
    let state_from_db: State = from_slice(&state_from_db_vec).unwrap();
    
    assert!(state_from_db == State {count: count.count }, "state after db_sync is't a expected.  is {:?} while expect {:?}", state_from_db, State {count: count.count });
}


/// Convenience function for testing
async fn prep_test_env() -> (
    OwnedDeps<IdbStorage, EmptyApi, EmptyQuerier>, 
    MessageInfo, 
    Env
) {
    let mut deps = create_lto_deps().await;
    deps.storage.clear_store("my_store");
    
    let info = MessageInfo{sender: Addr::unchecked("test_addr"), funds: Vec::new()};
    let env = create_lto_env();

    return (deps, info, env);
}

// TODO: test for different store names
