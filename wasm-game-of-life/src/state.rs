use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
// use cosmwasm_std::Addr; 

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct State {
    pub count: i32,
    // pub owner: Addr,
}

pub const STATE: State = State { count: 0 };