use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::Item;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub owner: Addr,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Ownership {
    pub owner: Addr,
    pub issuer: Addr,
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
pub struct NFT {
    pub Option<network>: String,    // eip155:1
    pub nft_id: Uint128,
    pub nft_contract_address: String, // 0x341...
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Network {
    // ascii code of char
    pub id: u8,
}

pub const NFT: Item<NFT> = Item::new("nft");
pub const CONFIG: Item<Config> = Item::new("config");
pub const CW721: Item<Cw721> = Item::new("cw721");
pub const LOCKED: Item<bool> = Item::new("is_locked");
pub const NETWORK: Item<Network> = Item::new("network");
pub const OWNERSHIP: Item<Ownership> = Item::new("ownership");
