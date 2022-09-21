use std::collections::HashMap;
use cosmwasm_std::{Addr, Deps, MemoryStorage, Order, Storage};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use wasm_bindgen::convert::FromWasmAbi;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    // pub max_capacity: u8,
    pub ownable_id: String,
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
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    // consumes percentage of remaining potion
    Consume { amount: u8 },
    // transfers ownership
    Transfer { to: Addr },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetOwnableConfig {},
    GetOwnableMetadata {},
}

// We define a custom struct for each query response
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct OwnableStateResponse {
    pub owner: String,
    pub issuer: String,
    pub current_amount: u8,
    pub max_capacity: u8,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub struct IdbStateDump {
    // map of the indexed db key value pairs of the state object store
    pub state_dump: HashMap<Vec<u8>, Vec<u8>>,
}

impl IdbStateDump {
    pub fn from(store: MemoryStorage) -> IdbStateDump {
        let mut state: HashMap<Vec<u8>, Vec<u8>> = HashMap::new();

        for (key, value) in store.range(None,None, Order::Ascending) {
            state.insert(key, value);
        }
        IdbStateDump {
            state_dump: state,
        }
    }
}

// from github.com/CosmWasm/cw-nfts/blob/main/contracts/cw721-metadata-onchain
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug, Default)]
pub struct Metadata {
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
