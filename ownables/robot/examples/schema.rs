use std::env::current_dir;
use std::fs::create_dir_all;

use cosmwasm_schema::{export_schema, remove_schemas, schema_for};
use ownable_std::{ExternalEventMsg, InfoResponse, Metadata};

use ownable_robot::msg::{InstantiateMsg, ExecuteMsg, QueryMsg};
use ownable_robot::state::{Config};

fn main() {
    let mut out_dir = current_dir().unwrap();
    out_dir.push("schema");
    create_dir_all(&out_dir).unwrap();
    remove_schemas(&out_dir).unwrap();

    export_schema(&schema_for!(InstantiateMsg), &out_dir);
    export_schema(&schema_for!(ExecuteMsg), &out_dir);
    export_schema(&schema_for!(QueryMsg), &out_dir);
    export_schema(&schema_for!(ExternalEventMsg), &out_dir);
    export_schema(&schema_for!(InfoResponse), &out_dir);
    export_schema(&schema_for!(Metadata), &out_dir);
    export_schema(&schema_for!(Config), &out_dir);
}
