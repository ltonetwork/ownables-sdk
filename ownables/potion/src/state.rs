use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::Item;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    // Ownable traits
    pub owner: Addr,
    pub issuer: Addr,
    pub max_capacity: u8,
    pub current_amount: u8,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Cw721 {
    // CW721 spec
    pub image: Option<String>,
    pub image_data: Option<String>,
    pub external_url: Option<String>,
    pub description: Option<String>,
    pub name: Option<String>,
    // pub attributes: Option<Vec<Trait>>,
    pub background_color: Option<String>,
    pub animation_url: Option<String>,
    pub youtube_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Bridge {
    pub is_bridged: bool,
    pub network: String,    // eip155:1
    pub nft_id: Uint128,
    pub nft_contract_address: String, // 0x341...
}

pub const BRIDGE: Item<Bridge> = Item::new("bridge");
pub const CONFIG: Item<Config> = Item::new("config");
pub const CW721: Item<Cw721> = Item::new("cw721");
