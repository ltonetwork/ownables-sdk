use crate::msg::InstantiateMsg;
use cosmwasm_std::{Addr, Coin, Empty, Uint128};
use cw_multi_test::{App, AppBuilder, Contract, ContractWrapper, Executor};
use crate::msg::ExecuteMsg;
use crate::state::NFT;

pub fn contract_template() -> Box<dyn Contract<Empty>> {
    let contract = ContractWrapper::new(
        crate::contract::execute,
        crate::contract::instantiate,
        crate::contract::query,
    );
    Box::new(contract)
}

const ADMIN: &str = "ADMIN";
const LTO_USER: &str = "GjSacB6a5DFNEHjDSmn724QsrRStKYzkahPH67wyrhAY";
const NATIVE_DENOM: &str = "denom";
// const LTO_ADDRESS: &str = "3JmCa4jLVv7Yn2XkCnBUGsa7WNFVEMxAfWe";

fn mock_app() -> App {
    AppBuilder::new().build(|router, _, storage| {
        router
            .bank
            .init_balance(
                storage,
                &Addr::unchecked(LTO_USER),
                vec![Coin {
                    denom: NATIVE_DENOM.to_string(),
                    amount: Uint128::new(1),
                }],
            )
            .unwrap();
    })
}

fn proper_instantiate() -> (App, Addr) {
    let mut app = mock_app();
    let cw_template_id = app.store_code(contract_template());

    let nft = NFT {
        nft_id: Uint128::one(),
        network: "eip155:1".to_string(),
        nft_contract_address: "nft-contract-address".to_string(),
    };

    let msg = InstantiateMsg {
        ownable_id: LTO_USER.to_string(),
        nft,
        network_id: 76,
        image: None,
        image_data: None,
        external_url: None,
        description: None,
        name: None,
        background_color: None,
        animation_url: None,
        youtube_url: None,
    };
    let ownable_addr = app
        .instantiate_contract(
            cw_template_id,
            Addr::unchecked(LTO_USER),
            &msg,
            &[],
            "test",
            None,
        )
        .unwrap();

    (app, ownable_addr)
}

#[test]
fn drink_percentage() {
    let (mut app, ownable_addr) = proper_instantiate();

    let msg = ExecuteMsg::Consume { amount: 1 };

    app.execute_contract(
        Addr::unchecked(LTO_USER),
        ownable_addr,
        &msg,
        &vec![]
    ).unwrap();
}

#[test]
fn transfer() {
    let (mut app, ownable_addr) = proper_instantiate();

    let msg = ExecuteMsg::Transfer {
        to: Addr::unchecked(ADMIN),
    };

    app.execute_contract(
        Addr::unchecked(LTO_USER),
        ownable_addr,
        &msg,
        &vec![]
    )
    .unwrap();
}
