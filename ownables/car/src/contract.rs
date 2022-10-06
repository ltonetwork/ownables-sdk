use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, Metadata, OwnableStateResponse, QueryMsg};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Binary, to_binary};
use cw2::set_contract_version;
use crate::state::{Config, CONFIG};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:ownable-car-demo";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    _msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let config = Config {
        owner: info.sender.clone(),
        issuer: info.sender.clone(),
        image: None,
        image_data: None,
        external_url: None,
        description: Some("Ownable car".to_string()),
        name: Some("Car".to_string()),
        background_color: None,
        animation_url: None,
        youtube_url: None
    };
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", info.sender.clone())
        .add_attribute("issuer", info.sender))
}

pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Transfer { to } => try_transfer(info, deps, to),
    }
}

pub fn try_transfer(info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    CONFIG.update(deps.storage, |mut config| -> Result<_, ContractError> {
        if info.sender != config.owner {
            return Err(ContractError::Unauthorized {
                val: "Unauthorized transfer attempt".to_string(),
            });
        }
        config.owner = to.clone();
        Ok(config)
    })?;
    Ok(Response::new()
        .add_attribute("method", "try_transfer")
        .add_attribute("new_owner", to.to_string())
    )
}

pub fn query(deps: Deps, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetOwnableConfig {} => query_ownable_config(deps),
        QueryMsg::GetOwnableMetadata {} => query_ownable_metadata(deps),
    }
}

fn query_ownable_config(deps: Deps) -> StdResult<Binary> {
    let config = CONFIG.load(deps.storage)?;
    to_binary(&OwnableStateResponse {
        owner: config.owner.into_string(),
        issuer: config.issuer.into_string(),
    })
}

fn query_ownable_metadata(deps: Deps) -> StdResult<Binary> {
    let config = CONFIG.load(deps.storage)?;
    to_binary(&Metadata {
        image: config.image,
        image_data: config.image_data,
        external_url: config.external_url,
        description: config.description,
        name: config.name,
        background_color: config.background_color,
        animation_url: config.animation_url,
        youtube_url: config.youtube_url,
    })
}

#[cfg(test)]
mod tests {
    use std::marker::PhantomData;
    use super::*;
    use cosmwasm_std::{Addr, MemoryStorage, MessageInfo, OwnedDeps, Response};
    use cosmwasm_std::testing::{mock_env, mock_info};
    use crate::utils::{EmptyApi, EmptyQuerier};

    struct CommonTest {
        deps: OwnedDeps<MemoryStorage, EmptyApi, EmptyQuerier>,
        info: MessageInfo,
        res: Response,
    }
    fn setup_test() -> CommonTest {
        let mut deps = OwnedDeps {
            storage: MemoryStorage::default(),
            api: EmptyApi::default(),
            querier: EmptyQuerier::default(),
            custom_query_type: PhantomData,
        };
        let info = mock_info("sender-1", &[]);

        let msg = InstantiateMsg {
            ownable_id: "2bJ69cFXzS8AJTcCmzjc9oeHZmBrmMVUr8svJ1mTGpho9izYrbZjrMr9q1YwvY".to_string(),
            image: None,
            image_data: None,
            external_url: None,
            description: Some("visual car ownable".to_string()),
            name: Some("Car".to_string()),
            background_color: None,
            animation_url: None,
            youtube_url: None
        };

        let res: Response = instantiate(deps.as_mut(), mock_env(), info.clone(), msg).unwrap();

        CommonTest {
            deps,
            info,
            res,
        }
    }

    #[test]
    fn test_initialize() {

        let CommonTest {
            deps: _,
            info: _,
            res,
        } = setup_test();

        assert_eq!(0, res.messages.len());
        assert_eq!(res.attributes.get(0).unwrap().value, "instantiate".to_string());
        assert_eq!(res.attributes.get(1).unwrap().value, "sender-1".to_string());
        assert_eq!(res.attributes.get(2).unwrap().value, "sender-1".to_string());
    }

    #[test]
    fn test_transfer() {
        let CommonTest {
            mut deps,
            info,
            res: _,
        } = setup_test();
        let deps = deps.as_mut();

        let msg = ExecuteMsg::Transfer { to: Addr::unchecked("other-owner-1") };

        let res: Response = execute(deps, mock_env(), info, msg).unwrap();

        assert_eq!(res.attributes.get(0).unwrap().value, "try_transfer".to_string());
        assert_eq!(res.attributes.get(1).unwrap().value, "other-owner-1".to_string());
    }

    #[test]
    fn test_transfer_unauthorized() {
        let CommonTest {
            mut deps,
            mut info,
            res: _,
        } = setup_test();
        let deps = deps.as_mut();
        info.sender = Addr::unchecked("not-the-owner".to_string());
        let msg = ExecuteMsg::Transfer { to: Addr::unchecked("not-the-owner") };

        let err: ContractError = execute(deps, mock_env(), info, msg)
            .unwrap_err();

        let _expected_err_val = "Unauthorized transfer attempt".to_string();
        assert!(matches!(err, ContractError::Unauthorized { val: _expected_err_val }));
    }

    #[test]
    fn test_query_config() {
        let CommonTest {
            deps,
            info: _,
            res: _,
        } = setup_test();

        let msg = QueryMsg::GetOwnableConfig {};
        let resp: Binary = query(deps.as_ref(), msg).unwrap();
        let json: String = "{\"owner\":\"sender-1\",\"issuer\":\"sender-1\"}".to_string();
        let expected_binary = Binary::from(json.as_bytes());

        assert_eq!(resp, expected_binary);
    }

    #[test]
    fn test_query_metadata() {
        let CommonTest {
            deps,
            info: _,
            res: _,
        } = setup_test();

        let msg = QueryMsg::GetOwnableMetadata {};
        let resp: Binary = query(deps.as_ref(), msg).unwrap();
        let json: String = "{\"image\":null,\"image_data\":null,\"external_url\":null,\"description\":\"Ownable car\",\"name\":\"Car\",\"background_color\":null,\"animation_url\":null,\"youtube_url\":null}".to_string();
        let expected_binary = Binary::from(json.as_bytes());

        assert_eq!(resp, expected_binary);
    }

}
