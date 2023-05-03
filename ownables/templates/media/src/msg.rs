use cosmwasm_std::{Addr};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ownable_std_macros::{
    ownables_transfer, ownables_lock,
    ownables_query_info, ownables_query_locked, ownables_query_metadata,
    ownables_query_widget_state, ownables_instantiate_msg
};
use ownable_std::NFT;

#[ownables_instantiate_msg]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct InstantiateMsg {}

#[ownables_transfer]
#[ownables_lock]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {}

#[ownables_query_info]
#[ownables_query_locked]
#[ownables_query_metadata]
#[ownables_query_widget_state]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {}

