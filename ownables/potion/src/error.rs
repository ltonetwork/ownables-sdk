use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized error val: {val:?}")]
    Unauthorized { val: String },

    #[error("Custom Error val: {val:?}")]
    CustomError { val: String },

    #[error("Bridge error: {val:?}")]
    BridgeError { val: String },

    #[error("Unknown event type: {val:?}")]
    MatchEventError { val: String },

    #[error("Unknown chain id: {val:?}")]
    MatchChainIdError { val: String },

    #[error("Invalid external event args")]
    InvalidExternalEventArgs {},
}
