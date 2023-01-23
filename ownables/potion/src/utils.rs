use crate::store::IdbStorage;
use cosmwasm_std::{Addr, Api, BlockInfo, CanonicalAddr, ContractInfo, Empty, Env, MemoryStorage, OwnedDeps, Querier, RecoverPubkeyError, StdError, StdResult, Timestamp, VerificationError};
use std::marker::PhantomData;
use blake2::Blake2bVar;
use blake2::digest::{Update, VariableOutput};
use crypto::digest::Digest;
use crate::IdbStateDump;
use crypto::sha3::Sha3;
use crypto::sha2::Sha256;

pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

pub fn create_lto_env() -> Env {
    Env {
        block: BlockInfo {
            height: 0,
            time: Timestamp::from_seconds(0),
            chain_id: "lto".to_string(),
        },
        contract: ContractInfo {
            address: Addr::unchecked(""),
        },
        transaction: None,
    }
}

pub fn load_lto_deps(state_dump: Option<IdbStateDump>) -> OwnedDeps<MemoryStorage, EmptyApi, EmptyQuerier, Empty> {
    match state_dump {
        None => OwnedDeps {
            storage: MemoryStorage::default(),
            api: EmptyApi::default(),
            querier: EmptyQuerier::default(),
            custom_query_type: PhantomData,
        },
        Some(dump) => {
            let idb_storage = IdbStorage::load(dump);
            OwnedDeps {
                storage: idb_storage.storage,
                api: EmptyApi::default(),
                querier: EmptyQuerier::default(),
                custom_query_type: PhantomData,
            }
        }
    }

}

pub fn address_eip155(mut public_key: String) -> Result<Addr, StdError> {
    if public_key.is_empty() {
        return Err(StdError::not_found("empty input"));
    }

    // indicates uncompressed point public key prefix
    if public_key.starts_with("0x04") {
        public_key = public_key.split_off(4);
    }

    if let Err(err) = hex::decode(public_key.clone()) {
        return Err(StdError::generic_err(err.to_string()));
    }

    let mut hasher = Sha3::keccak256();
    hasher.input(hex::decode(public_key.as_bytes())
        .unwrap()
        .as_slice()
    );
    let hashed_addr = hasher.result_str();
    let result = &hashed_addr[hashed_addr.len() - 40..];

    let checksum_addr = "0x".to_owned() + eip_55_checksum(result).as_str();

    Ok(Addr::unchecked(checksum_addr))
}

fn eip_55_checksum(addr: &str) -> String {
    let mut checksum_hasher = Sha3::keccak256();
    checksum_hasher.input(&addr[addr.len() - 40..].as_bytes());
    let hashed_addr = checksum_hasher.result_str();

    let mut checksum_buff = "".to_owned();
    let result_chars: Vec<char> = addr.chars()
        .into_iter()
        .collect();
    let keccak_chars: Vec<char> = hashed_addr.chars()
        .into_iter()
        .collect();
    for i in 0..addr.len() {
        let mut char = result_chars[i];
        if char.is_alphabetic() {
            let keccak_digit = keccak_chars[i]
                .to_digit(16)
                .unwrap();
            // if the corresponding hex digit >= 8, convert to uppercase
            if keccak_digit >= 8 {
                char = char.to_ascii_uppercase();
            }
        }
        checksum_buff += char.to_string().as_str();
    }

    checksum_buff
}

pub fn address_lto(network_id: char, public_key: String) -> Result<Addr, StdError> {
    if network_id != 'L' && network_id != 'T' {
        return Err(StdError::generic_err("unrecognized network_id"));
    }
    if public_key.len() != 44 || bs58::decode(public_key.clone()).into_vec().is_err() {
        return Err(StdError::generic_err("invalid public key"));
    }

    // decode b58 of pubkey into byte array
    let public_key = bs58::decode(public_key).into_vec().unwrap();
    // get the ascii value from network char
    let network_id = network_id as u8;
    let pub_key_secure_hash = secure_hash(public_key.as_slice());
    // get the first 20 bytes of the securehash
    let address_bytes = &pub_key_secure_hash[0..20];
    let version = &1_u8.to_be_bytes();
    let checksum_input:Vec<u8> = [version, &[network_id], address_bytes].concat();

    // checksum is the first 4 bytes of secureHash of version, chain_id, and hash
    let checksum = &secure_hash(checksum_input.as_slice())
        .to_vec()[0..4];

    let addr_fields = [
        version,
        &[network_id],
        address_bytes,
        checksum
    ];

    let address: Vec<u8> = addr_fields.concat();
    Ok(Addr::unchecked(base58(address.as_slice())))
}

fn base58(input: &[u8]) -> String {
    bs58::encode(input).into_string()
}

fn secure_hash(m: &[u8]) -> Vec<u8> {
    let mut hasher = Blake2bVar::new(32).unwrap();
    hasher.update(m);
    let mut buf = [0u8; 32];
    hasher.finalize_variable(&mut buf).unwrap();

    // get the sha256 of blake
    let mut hasher = Sha256::new();
    hasher.input(&buf);

    let mut buf = [0u8; 32];
    hasher.result(&mut buf);
    buf.to_vec()
}

const CANONICAL_LENGTH: usize = 54;

/// Empty Querier that is meant to conform the traits expected by the cosmwasm standard contract syntax. It should not be used whatsoever
#[derive(Default)]
pub struct EmptyQuerier {}

impl Querier for EmptyQuerier {
    fn raw_query(&self, _bin_request: &[u8]) -> cosmwasm_std::QuerierResult {
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

        let tmp: Vec<u8> = canonical.clone().into();
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
        _message_hash: &[u8],
        _signature: &[u8],
        _public_key: &[u8],
    ) -> Result<bool, VerificationError> {
        Err(VerificationError::unknown_err(0))
    }

    fn secp256k1_recover_pubkey(
        &self,
        _message_hash: &[u8],
        _signature: &[u8],
        _recovery_param: u8,
    ) -> Result<Vec<u8>, RecoverPubkeyError> {
        Err(RecoverPubkeyError::unknown_err(0))
    }

    fn ed25519_verify(
        &self,
        _message: &[u8],
        _signature: &[u8],
        _public_key: &[u8],
    ) -> Result<bool, VerificationError> {
        Ok(true)
    }

    fn ed25519_batch_verify(
        &self,
        _messages: &[&[u8]],
        _signatures: &[&[u8]],
        _public_keys: &[&[u8]],
    ) -> Result<bool, VerificationError> {
        Ok(true)
    }

    fn debug(&self, message: &str) {
        println!("{}", message);
    }
}

#[cfg(test)]
mod utils {
    use cosmwasm_std::StdError;
    use crate::utils::{address_eip155, address_lto};

    #[test]
    fn test_derive_eip155_address() {
        let pub_key = "0x04e71a3edcf033799698c988125fcd4ff49e6eb3e944d8b595da98fa5e7f4b9a34f1c40b96d736d17910f9cd6225fae3af63c0d451f9977a463b04df2f45ceb917";

        let result = address_eip155(pub_key.to_string()).unwrap();
        assert_eq!(result.to_string(), "0xcf7007918c0226DbdDb858Ec459A5c50167D81A7");
    }

    #[test]
    fn test_eip155_empty_input() {
        let pub_key = "";
        let err = address_eip155(pub_key.to_string()).unwrap_err();

        assert!(matches!(err, StdError::NotFound {..}));
    }

    #[test]
    fn test_eip155_invalid_hex() {
        let pub_key = "!?";
        let err = address_eip155(pub_key.to_string()).unwrap_err();

        assert!(matches!(err, StdError::GenericErr {..}));
    }

    #[test]
    fn test_derive_lto_address() {
        let result = address_lto(
            'L',
            "GjSacB6a5DFNEHjDSmn724QsrRStKYzkahPH67wyrhAY".to_string(),
        ).unwrap();

        assert_eq!(result.to_string(), "3JmCa4jLVv7Yn2XkCnBUGsa7WNFVEMxAfWe");
    }

    #[test]
    fn test_derive_lto_address_invalid_network_id() {
        let err = address_lto(
            'A',
            "GjSacB6a5DFNEHjDSmn724QsrRStKYzkahPH67wyrhAY".to_string(),
        ).unwrap_err();

        assert!(matches!(err, StdError::GenericErr { .. }));
    }

    #[test]
    fn test_derive_lto_address_invalid_pub_key() {
        let err = address_lto(
            'L',
            "GjSacB6a5Dl1iINEHjDSmnQsrRStKYzkahPH67wyrhAY".to_string(),
        ).unwrap_err();

        assert!(matches!(err, StdError::GenericErr { .. }));
    }
}
