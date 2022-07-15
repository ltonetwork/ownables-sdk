import * as wasm from "ownable-demo";
import {Event, EventChain} from "@ltonetwork/lto/lib/events";
import {
  deleteIndexedDb,
  initIndexedDb,
  writeExecuteEventToIdb,
  writeInstantiateEventToIdb
} from "./event-chain";
import {getDrinkAmount, initializePotionHTML, updateState} from "./index";
import {LTO} from '@ltonetwork/lto';

const lto = new LTO('T');
const account = lto.account();

const MESSAGE_INFO = {
  sender: account.address,
  funds: [],
}

export async function consumeOwnable(ownable_id) {
  let msg = {
    "consume": {
      "amount": getDrinkAmount(ownable_id),
    },
  };

  const newEvent = new Event({"@context": "execute_msg.json", ...msg});
  let db = await writeExecuteEventToIdb(ownable_id, newEvent, account);
  db.close();

  wasm.execute_contract(msg, MESSAGE_INFO, ownable_id).then(
    (resp) => {
      queryState(ownable_id);
    },
    (err) => window.alert("attempting to consume more than possible")
  );
}

export function deleteOwnable(ownable_id) {
  deleteIndexedDb(ownable_id);
}

export function queryState(ownable_id) {
  wasm.query_contract_state(ownable_id).then(
    (ownable) => {
      updateState(ownable_id, ownable.current_amount);
      return ownable.current_amount;
    }
  );
}

function extractAttributeValue(attributes, key) {
  return attributes.filter(prop => {
    return prop.key === key
  })[0].value;
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

  const db = await initIndexedDb(msg.ownable_id);
  let newEvent = chain.add(new Event({"@context": "instantiate_msg.json", ...msg})).signWith(account);
  writeInstantiateEventToIdb(db, newEvent);

  // close db to not block the wasm side from accessing it
  db.close();

  const resp = await wasm.instantiate_contract(msg, MESSAGE_INFO);
  const ownable = JSON.parse(resp);
  let color = extractAttributeValue(ownable.attributes, "color");
  let amount_str = extractAttributeValue(ownable.attributes, "capacity");
  initializePotionHTML(msg.ownable_id, parseInt(amount_str), color);
}

export async function syncDb() {
  // TODO: maybe clear existing grid beforehand
  const chainIds = JSON.parse(localStorage.chainIds);

  for (let i = 0; i < chainIds.length; i++) {
    let contractState = await wasm.query_contract_state(chainIds[i]);
    if (document.getElementById(chainIds[i]) === null) {
      initializePotionHTML(chainIds[i], contractState.current_amount, contractState.color_hex);
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
      wasm.execute_contract(msg, MESSAGE_INFO, ownable_id).then(
        (resp) => console.log(resp)
      )
    }
  } else {
    alert(`${addr} is not a valid address`);
  }
}
