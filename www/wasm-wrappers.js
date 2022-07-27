import * as wasm from "ownable-demo";
import {Event, EventChain} from "@ltonetwork/lto/lib/events";
import {
  deleteIndexedDb, initIndexedDb,
  writeExecuteEventToIdb,
  writeInstantiateEventToIdb
} from "./event-chain";
import {IdbStore} from "./idb-store";
import {updateState} from "./index";
import {LTO} from '@ltonetwork/lto';
const lto = new LTO('T');


function getAccount() {
  let existingSeed = localStorage.encryptedSeed;
  let account;
  if (existingSeed === undefined) {
    const pw = window.prompt("Setup a password for your account", "");
    account = lto.account();
    localStorage.encryptedSeed = account.encryptSeed(pw);
  } else {
    account = attemptToDecryptSeed(existingSeed);
  }
  return account;
}

function attemptToDecryptSeed(seed, promptMsg = "Enter your password") {
  let account;
  while (account === undefined) {
    const pw = window.prompt(promptMsg, "");
    const settings = {
      seed: seed,
      seedPassword: pw,
    };
    try {
      account = lto.account(settings);
      window.alert("Successfully authenticated");
      return account;
    } catch (e) {
      promptMsg = "Invalid password, try again";
    }
  }
}

function getMessageInfo() {
  return {
    sender: account.address,
    funds: [],
  }
}

export async function executeOwnable(ownable_id, msg) {
  const newEvent = new Event({"@context": "execute_msg.json", ...msg});

  await initIndexedDb(msg.ownable_id);
  let idbStore = new IdbStore(msg.ownable_id);

  await writeExecuteEventToIdb(ownable_id, newEvent, account);
  wasm.execute_contract(msg, getMessageInfo(), ownable_id, idbStore).then(
    (resp) => {
      queryState(ownable_id, idbStore);
    },
    (err) => window.alert("attempting to consume more than possible")
  );
}

export function deleteOwnable(ownable_id) {
  deleteIndexedDb(ownable_id);
}

export function queryState(ownable_id, idbStore) {
  wasm.query_contract_state(ownable_id, idbStore).then(
    (ownable) => {
      updateState(ownable_id, {
        amount: ownable.current_amount,
        color: ownable.color_hex,
      });
    }
  );
}



export async function issueOwnable() {
  // issue a new event chain
  const chain = EventChain.create(account);
  const msg = {
    max_capacity: 100,
    ownable_id: chain.id,
  };

  let chainIds = JSON.parse(localStorage.chainIds);
  chainIds.push(msg.ownable_id);
  localStorage.chainIds = JSON.stringify(chainIds);

  await initIndexedDb(msg.ownable_id);

  let idbStore = new IdbStore(msg.ownable_id);

  let newEvent = chain.add(new Event({"@context": "instantiate_msg.json", ...msg})).signWith(account);
  writeInstantiateEventToIdb(await idbStore.get_db(), newEvent);

  const resp = await wasm.instantiate_contract(msg, getMessageInfo(), idbStore);
  return {
    ownable_id: msg.ownable_id,
    ...JSON.parse(resp)
  };
}

export async function syncDb(callback) {
  // TODO: maybe clear existing grid beforehand
  const chainIds = JSON.parse(localStorage.chainIds);
  console.log(chainIds, " are syncing");
  for (let i = 0; i < chainIds.length; i++) {
    let idb = await initIndexedDb(chainIds[i]);
    let idbStore = new IdbStore(chainIds[i]);
    let contractState = await wasm.query_contract_state(chainIds[i], idbStore);
    if (document.getElementById(chainIds[i]) === null) {
      callback(chainIds[i], contractState.current_amount, contractState.color_hex);
    } else {
      console.log('potion already initialized');
    }
  }
}

export function transferOwnable(ownable_id) {
  let addr = window.prompt("Transfer the Ownable to: ", null);
  if (lto.isValidAddress(addr)) {
    const msg = {
      transfer: {
        to: addr,
      },
    };
    if (confirm(`Confirm:\n${JSON.stringify(msg)}`)) {
      wasm.execute_contract(msg, getMessageInfo(), ownable_id).then(
        (resp) => console.log(resp)
      )
    }
  } else {
    alert(`${addr} is not a valid address`);
  }
}

// Todo I want to be moved
let account = getAccount();
