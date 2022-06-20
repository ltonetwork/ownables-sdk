use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use cosmwasm_std::Addr;
use cw_storage_plus::Item;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct State {
    pub owner: Addr,
    pub issuer: Addr,
    pub max_capacity: u8,
    pub current_amount: u8,
}

pub const STATE: Item<State> = Item::new("state");
