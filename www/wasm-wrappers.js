import * as wasm from "ownable-demo";
import {Event, EventChain} from "@ltonetwork/lto/lib/events";
import {initIndexedDb, writeExecuteEventToIdb, writeInstantiateEventToIdb} from "./event-chain";
import {getDrinkAmount, initializePotionHTML} from "./index";
import {LTO} from '@ltonetwork/lto';

const lto = new LTO('T');
const account = lto.account();

const MESSAGE_INFO = {
  sender: account.address,
  funds: [],
}

export function consumeOwnable(ownable_id) {
  let msg = {
    "consume": {
      "amount": getDrinkAmount(ownable_id),
    },
  };

  wasm.execute_contract(msg, MESSAGE_INFO, ownable_id).then(
    (resp) => {
      const newEvent = new Event({"@context": "execute_msg.json", ...msg});
      writeExecuteEventToIdb(ownable_id, newEvent, account);
      queryState(ownable_id);
    },
    (err) => window.alert("attempting to consume more than possible")
  );
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

export function issueOwnable() {
  // issue a new event chain
  const chain = EventChain.create(account);
  const msg = {
    max_capacity: 100,
    ownable_id: chain.id,
  };

  let chainIds = JSON.parse(localStorage.chainIds);
  chainIds.push(msg.ownable_id);
  localStorage.chainIds = JSON.stringify(chainIds);

  initIndexedDb(msg.ownable_id);
  let newEvent = chain.add(new Event({"@context": "instantiate_msg.json", ...msg})).signWith(account);
  writeInstantiateEventToIdb(newEvent, msg.ownable_id);

  wasm.instantiate_contract(msg, MESSAGE_INFO).then(
    (resp) => {
      const ownable = JSON.parse(resp);
      let color = extractAttributeValue(ownable.attributes, "color");
      let amount_str = extractAttributeValue(ownable.attributes, "capacity");
      initializePotionHTML(msg.ownable_id, parseInt(amount_str), color);
    },
    (err) => window.alert("failed to instantiate contract")
  );
}


export function transferOwnable(ownable_id) {
  let addr = window.prompt("Transfer the ownable to: ", null);
  if (lto.isValidAddress(addr)) {
    const msg = {
      transfer: {
        to: addr,
      },
    };

    wasm.execute_contract(msg, MESSAGE_INFO, ownable_id).then(
      (resp) => console.log(resp)
    )
  }
}
