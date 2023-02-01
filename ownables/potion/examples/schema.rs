use std::env::current_dir;
use std::fs::create_dir_all;

use cosmwasm_schema::{export_schema, remove_schemas, schema_for};

use ownable_potion::msg::{InstantiateMsg};
use ownable_potion::state::Config;

fn main() {
    let mut out_dir = current_dir().unwrap();
    out_dir.push("./assets/");
    create_dir_all(&out_dir).unwrap();
    remove_schemas(&out_dir).unwrap();

    export_schema(&schema_for!(InstantiateMsg), &out_dir);
}
