use cosmwasm_std::{Addr};
use ownable_std::NFT;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ownable_std_macros::{ownables_std_execute_msg, ownables_std_query_msg, ownables_std_instantiate_msg};

#[ownables_std_instantiate_msg]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {}

#[ownables_std_execute_msg]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {}

#[ownables_std_query_msg]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {}


