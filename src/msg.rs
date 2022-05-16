use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub count: i32,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    // #[serde(with = "serde_with::rust::display_fromstr")]
    Increment {by: Option<i32>},
    Reset {count: i32}
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetCount(),
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct CountResponse {
    pub count: i32,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct EventBody {
    pub timestamp: i32,
    pub memo: String,
    pub count: i32,

}

pub enum EventType {
    Genesis,
    Mod,
}


