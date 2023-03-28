use cosmwasm_std::{Addr};
use ownable_std::NFT;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

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
    // consumes the ownable
    Consume {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetInfo {},
    GetMetadata {},
    GetWidgetState {},
    IsLocked {},
    IsConsumerOf {
        issuer: Addr,
        consumable_type: String,
    }
}


