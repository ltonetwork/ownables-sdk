use std::collections::HashMap;
use cosmwasm_std::{Addr};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_with::serde_as;
use crate::state::NFT;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub ownable_id: String,
    pub package: String,
    pub nft: Option<NFT>,
    pub ownable_type: Option<String>,
    pub network_id: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    // transfers ownership
    Transfer { to: Addr },
    // locks the ownable
    Lock {},
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub struct ExternalEventMsg {
    pub chain_id: String, // CAIP-2 format (e.g. ethereum: eip155:1)
    pub event_type: String,
    pub args: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetInfo {},
    GetMetadata {},
    GetWidgetState {},
    IsLocked {},
}

// We define a custom struct for each query response
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InfoResponse {
    pub owner: Addr,
    pub issuer: Addr,
    pub nft: Option<NFT>,
    pub ownable_type: Option<String>,
}

#[serde_as]
#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct IdbStateDump {
    // map of the indexed db key value pairs of the state object store
    #[serde_as(as = "Vec<(_, _)>")]
    pub state_dump: HashMap<Vec<u8>, Vec<u8>>,
}

