use std::env::current_dir;
use std::fs::create_dir_all;

use cosmwasm_schema::{export_schema, remove_schemas, schema_for, write_api};

use ownable_armor::msg::{InstantiateMsg, ExecuteMsg, QueryMsg, InfoResponse, ExternalEventMsg};
use ownable_armor::state::{Config, Cw721};

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
    export_schema(&schema_for!(Cw721), &out_dir);
    export_schema(&schema_for!(Config), &out_dir);
}

