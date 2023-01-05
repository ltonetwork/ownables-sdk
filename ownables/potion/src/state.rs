use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use cosmwasm_std::Addr;
use cw_storage_plus::Item;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    // Ownable traits
    pub owner: Addr,
    pub issuer: Addr,
    pub max_capacity: u8,
    pub current_amount: u8,
    pub color: String,
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

    // bridge address
    pub bridge: Option<Addr>,
}

pub const CONFIG: Item<Config> = Item::new("config");
