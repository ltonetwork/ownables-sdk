use cosmwasm_std::Addr;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize, Serializer};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub max_capacity: u8,
    pub ownable_id: String,
    pub contract_id: String,
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
    // returns the current remaining amount of potion as a json-encoded number
    GetCurrentAmount {},
    // GetOwner {},
}

// We define a custom struct for each query response
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct PotionStateResponse {
    pub owner: String,
    pub issuer: String,
    pub current_amount: u8,
    pub max_capacity: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct OwnershipResponse {
    pub owner: Addr,
    pub issuer: Addr,
}
