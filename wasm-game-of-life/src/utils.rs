use std::marker::PhantomData;


use cosmwasm_std::{Addr, ContractInfo, Timestamp, Empty, OwnedDeps, Querier, Api, StdResult, StdError, CanonicalAddr, VerificationError, RecoverPubkeyError};
use cosmwasm_std::{BlockInfo, Env};

use crate::store::{IdbStorage};



pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}


pub fn create_lto_env() -> Env {
    let env = Env {
        block: BlockInfo { height: 0, time: Timestamp::from_seconds(0), chain_id: "lto".to_string() },
        contract: ContractInfo { address: Addr::unchecked("")},
        transaction: None
    };
    return env;
}

/// Creates Owned deps that conforms cosmwasm_std contract standards. Except for the storage, the atributes of this deps should not be used.
pub async fn create_lto_deps() -> OwnedDeps<IdbStorage, EmptyApi, EmptyQuerier, Empty>  {

    OwnedDeps {
        storage: IdbStorage::load("test_store").await, // Storage should now be our Storage implementation that uses local store
        api: EmptyApi::default(),
        querier: EmptyQuerier::default(),
        custom_query_type: PhantomData,
    }
}


/* Notes on the DepsMut:
DepsMut's storage can be replaced by the LocalStorage, however the storage manipulations inferred by the Storage trait are not used.
DepsMut api is now just a mockApi from cosmwasm tests. The functions of api in this sense are: 
- validate the human readable address
- canonical address to human and other way
- some cryptography

This might be replaced with a LPO api in the future
*/

/* Notes about Env:
Env is a simple wrapper around some transaction and block info. Would be nice to make a Env var that fits the LTO blockchain.
So the events can include some information about who applied which event.
*/

// ---------------- IMPORTANT: ------------------
// The code below is copied from cosmwasm_std::testing, because those features arent exported in the default cosmwasm_std release build
// The functions in EmptyQuerier and EmptyApi Are not meant to be useful, just to conform the traits.

const CANONICAL_LENGTH: usize = 54;

/// Empty Querier that is meant to conform the traits expected by the cosmwasm standard contract syntax. It should not be used whatsoever 
pub struct EmptyQuerier {

}

impl Default for EmptyQuerier {
    fn default() -> Self {
        Self {  }
    }
}

impl Querier for EmptyQuerier {
    fn raw_query(&self, bin_request: &[u8]) -> cosmwasm_std::QuerierResult {
        todo!()
    }
}

// EmptyApi that is meant to conform the traits by the cosmwasm standard contract syntax. The functions of this implementation are not meant to be used or produce any sensible results.
#[derive(Copy, Clone)]
pub struct EmptyApi {
    /// Length of canonical addresses created with this API. Contracts should not make any assumtions
    /// what this value is.
    canonical_length: usize,
}

impl Default for EmptyApi {
    fn default() -> Self {
        EmptyApi {
            canonical_length: CANONICAL_LENGTH,
        }
    }
}

impl Api for EmptyApi {
    fn addr_validate(&self, human: &str) -> StdResult<Addr> {
        self.addr_canonicalize(human).map(|_canonical| ())?;
        Ok(Addr::unchecked(human))
    }

    fn addr_canonicalize(&self, human: &str) -> StdResult<CanonicalAddr> {
        // Dummy input validation. This is more sophisticated for formats like bech32, where format and checksum are validated.
        if human.len() < 3 {
            return Err(StdError::generic_err(
                "Invalid input: human address too short",
            ));
        }
        if human.len() > self.canonical_length {
            return Err(StdError::generic_err(
                "Invalid input: human address too long",
            ));
        }

        let mut out = Vec::from(human);

        // pad to canonical length with NULL bytes
        out.resize(self.canonical_length, 0x00);
        // // content-dependent rotate followed by shuffle to destroy
        // // the most obvious structure (https://github.com/CosmWasm/cosmwasm/issues/552)
        // let rotate_by = digit_sum(&out) % self.canonical_length;
        // out.rotate_left(rotate_by);
        // for _ in 0..SHUFFLES_ENCODE {
        //     out = riffle_shuffle(&out);
        // }
        Ok(out.into())
    }

    fn addr_humanize(&self, canonical: &CanonicalAddr) -> StdResult<Addr> {
        if canonical.len() != self.canonical_length {
            return Err(StdError::generic_err(
                "Invalid input: canonical address length not correct",
            ));
        }

        let mut tmp: Vec<u8> = canonical.clone().into();
        // // Shuffle two more times which restored the original value (24 elements are back to original after 20 rounds)
        // for _ in 0..SHUFFLES_DECODE {
        //     tmp = riffle_shuffle(&tmp);
        // }
        // // Rotate back
        // let rotate_by = digit_sum(&tmp) % self.canonical_length;
        // tmp.rotate_right(rotate_by);
        // Remove NULL bytes (i.e. the padding)
        let trimmed = tmp.into_iter().filter(|&x| x != 0x00).collect();
        // decode UTF-8 bytes into string
        let human = String::from_utf8(trimmed)?;
        Ok(Addr::unchecked(human))
    }

    fn secp256k1_verify(
        &self,
        message_hash: &[u8],
        signature: &[u8],
        public_key: &[u8],
    ) -> Result<bool, VerificationError> {
         Err(VerificationError::unknown_err(0))
    }

    fn secp256k1_recover_pubkey(
        &self,
        message_hash: &[u8],
        signature: &[u8],
        recovery_param: u8,
    ) -> Result<Vec<u8>, RecoverPubkeyError> {
        Err(RecoverPubkeyError::unknown_err(0))
    }

    fn ed25519_verify(
        &self,
        message: &[u8],
        signature: &[u8],
        public_key: &[u8],
    ) -> Result<bool, VerificationError> {
        Ok(true)
    }

    fn ed25519_batch_verify(
        &self,
        messages: &[&[u8]],
        signatures: &[&[u8]],
        public_keys: &[&[u8]],
    ) -> Result<bool, VerificationError> {
        Ok(true)
    }

    fn debug(&self, message: &str) {
        println!("{}", message);
    }
}