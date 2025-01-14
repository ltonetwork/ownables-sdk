use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized error: {val:?}")]
    Unauthorized { val: String },

    #[error("{val:?}")]
    CustomError { val: String },

    #[error("Lock error: {val:?}")]
    LockError { val: String },

    #[error("Unknown event type: {val:?}")]
    MatchEventError { val: String },

    #[error("Unknown chain id: {val:?}")]
    MatchChainIdError { val: String },

    #[error("Invalid external event args")]
    InvalidExternalEventArgs {},

    #[error("Method is not implemented for this Ownable")]
    NotImplemented {},
}
