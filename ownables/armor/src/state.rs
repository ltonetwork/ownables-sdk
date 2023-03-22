use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::Item;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    // None if still available to consumption
    pub consumed_by: Option<Addr>,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct OwnableInfo {
    pub owner: Addr,
    pub issuer: Addr,
    pub ownable_type: Option<String>,
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
    pub network: Option<String>,    // eip155:1
    pub id: Uint128,
    pub address: String, // 0x341...
    pub lock_service: Option<String>,
}

pub const CONFIG: Item<Option<Config>> = Item::new("config");
pub const OWNABLE_INFO: Item<OwnableInfo> = Item::new("ownable_info");
pub const CW721: Item<Cw721> = Item::new("cw721");
pub const NFT: Item<NFT> = Item::new("nft");
pub const LOCKED: Item<bool> = Item::new("is_locked");
pub const PACKAGE_IPFS: Item<String> = Item::new("package_ipfs");
pub const NETWORK_ID: Item<u8> = Item::new("network_id");
