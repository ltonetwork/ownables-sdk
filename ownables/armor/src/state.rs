use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cosmwasm_std::Addr;
use cw_storage_plus::Item;
use ownable_std::{Metadata, NFT, OwnableInfo};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    // None if still available to consumption
    pub consumed_by: Option<Addr>,
    pub color: String,
}

pub const CONFIG: Item<Option<Config>> = Item::new("config");
pub const OWNABLE_INFO: Item<OwnableInfo> = Item::new("ownable_info");
pub const METADATA: Item<Metadata> = Item::new("metadata");
pub const NFT_ITEM: Item<NFT> = Item::new("nft");
pub const LOCKED: Item<bool> = Item::new("is_locked");
pub const PACKAGE_CID: Item<String> = Item::new("package_cid");
pub const NETWORK_ID: Item<u8> = Item::new("network_id");
