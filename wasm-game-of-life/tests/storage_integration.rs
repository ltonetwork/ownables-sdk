//! Test suite for the Web and headless browsers.
// #![cfg(target_arch = "wasm32")]


extern crate wasm_bindgen_test;
use std::convert::{TryFrom, TryInto};
use std::io::Read;
use std::{assert, panic};
use cw_storage_plus::{CwIntKey, Endian};
use wasm_bindgen_test::*;
use cosmwasm_std::{ OwnedDeps, MessageInfo, Addr, Env, from_binary, to_vec};


// use wasm_game_of_life::contract::execute;
use wasm_game_of_life::msg::{ExecuteMsg, QueryMsg, InstantiateMsg};
use wasm_game_of_life::state::State;
use wasm_game_of_life::store::IdbStorage;
// use wasm_game_of_life::*;
use wasm_game_of_life::contract::*;
use wasm_game_of_life::utils::{create_lto_deps, create_lto_env, EmptyApi, EmptyQuerier};


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
            assert!(err.to_string() == "wasm_game_of_life::state::State not found", "expected error 'wasm_game_of_life::state::State not found'. got '{}'", &err.to_string())
        }
    }
}


// FIXME: tests without initial state get data from indexed db from other tests!!! 

#[wasm_bindgen_test]
async fn execute_contract_with_initial_state() {
    // TODO
}

/// Query
#[wasm_bindgen_test]
async fn query_state_no_initial_state() {
    let msg = QueryMsg::GetCount();

    let deps = create_lto_deps().await;

    // query contract with increment, Without a state present in the database: should panic!
    let res_state = query(deps.as_ref(), msg);
    match res_state {
        Ok(_res) => panic!("The state should not be found."),
        Err(err) => {
            assert!(err.to_string() == "wasm_game_of_life::state::State not found", "expected error 'NotFound'. got {}", &err.to_string())
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

    let state_from_db = deps.storage.get_item(b"state").await;
    
    // FIXME: THe state saved to the memstore is the state struct, not the count. 
    //          I should convert the state_from_db to a state var and then get the count
    // let dbstate: State = state_from_db.try_into().unwrap();
    // let state_bytes: [u8; 4] = state_from_db.as_slice();
    
    // state_bytes = state_from_db.align_to();
    // i32::from_be_bytes(state_from_db.bytes().);
    // let state_db = i32::from_be_bytes(&[state_from_db.into_iter()]);
    
    assert!(state_from_db == count.count.to_be_bytes(), "state after db_sync is't a expected.  is {:?} while expect {:?}", state_from_db, to_vec(&State {count: count.count }).unwrap())
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
