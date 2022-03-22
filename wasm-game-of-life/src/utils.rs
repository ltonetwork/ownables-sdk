use cosmwasm_std::testing::{MockApi, MockQuerier};
use cosmwasm_std::{Addr, ContractInfo, TransactionInfo, Timestamp, Storage};
use cosmwasm_std::{to_binary, BlockInfo, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult};



pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}


pub fn create_lto_env() -> Env {
    let env = Env {
        block: BlockInfo { height: 0, time: Timestamp::from_seconds(0), chain_id: "lto".to_string() },
        contract: ContractInfo { address: Addr::unchecked("")},
        transaction: None
    };
    return env;
}

// pub fn create_deps() -> DepsMut {
//     let deps = DepsMut {
//         storage: ,// Storage should now be our Storage implementation that uses local store
//         api: MockApi::default(),
//         querier: MockQuerier::default()
//     }
// }