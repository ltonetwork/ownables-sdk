import * as wasm from "ownable-demo";
import {Event, EventChain} from "@ltonetwork/lto/lib/events"
import {
  syncDb,
  writeInstantiateEventToIdb,
  writeExecuteEventToIdb
} from "./event-chain";
import {LTO} from '@ltonetwork/lto';

const lto = new LTO('T');
const account = lto.account();

// if no chainIds found, init empty
if (localStorage.getItem("chainIds") === null) {
  localStorage.chainIds = JSON.stringify([]);
}

function queryState(ownable_id) {
  wasm.query_contract_state(ownable_id).then(
    (ownable) => {
      updateState(ownable_id, ownable.current_amount);
      return ownable.current_amount;
    }
  );
}

function consumeOwnable(ownable_id) {
  let msg = {
    "consume": {
      "amount": getDrinkAmount(ownable_id),
    },
  };
  let info = {
    sender: account.address,
    funds: [],
  }

  wasm.execute_contract(msg, info, ownable_id).then(
    (resp) => {
      const newEvent = new Event({"@context": "execute_msg.json", ...msg});
      writeExecuteEventToIdb(ownable_id, newEvent, account);
      queryState(ownable_id);
    },
    (err) => window.alert("attempting to consume more than possible")
  );

}

function getDrinkAmount(ownable_id) {
  let stringAmount = document.getElementById(ownable_id)
    .getElementsByClassName('slider')[0].valueOf().value;
  return parseInt(stringAmount);
}

function updateState(ownable_id, amt) {
  document.getElementById(ownable_id).getElementsByClassName('juice')[0].style.top = (100 - amt) / 2 + '%';
  document.getElementById(ownable_id).getElementsByClassName('amount')[0].textContent = amt;
}

function issuePotion() {
  // issue a new event chain
  const chain = EventChain.create(account);
  const msg = {
    max_capacity: 100,
    ownable_id: chain.id,
  };
  const info = {
    sender: account.address,
    funds: [],
  };

  let chainIds = JSON.parse(localStorage.chainIds);
  chainIds.push(msg.ownable_id);
  localStorage.chainIds = JSON.stringify(chainIds);

  initIndexedDb(msg.ownable_id);
  let newEvent = chain.add(new Event({"@context": "instantiate_msg.json", ...msg})).signWith(account);
  writeInstantiateEventToIdb(newEvent, msg.ownable_id, true);

  wasm.instantiate_contract(msg, info).then(
    (resp) => {
      const ownable = JSON.parse(resp);
      let color = extractAttributeValue(ownable.attributes, "color");
      let amount_str = extractAttributeValue(ownable.attributes, "capacity");
      initializePotionHTML(msg.ownable_id, parseInt(amount_str), color);
    },
    (err) => window.alert("failed to instantiate contract")
  );
}

function initIndexedDb(ownable_id) {
  const request = window.indexedDB.open(ownable_id, 1);
  let db;
  request.onupgradeneeded = event => {
    db = request.result;
    console.log("onupgradeneeded trigger");
    if (!db.objectStoreNames.contains("events")) {
      db.createObjectStore("events");
    }
    if (!db.objectStoreNames.contains("chain")) {
      db.createObjectStore("chain");
    }
  }

  request.onsuccess = event => {
    console.log("onsuccess");
    db = request.result;
  }
}

function extractAttributeValue(attributes, key) {
  return attributes.filter(prop => {
    return prop.key === key
  })[0].value;
}

function transferOwnable(ownable_id) {
  let addr = window.prompt("Transfer the ownable to: ", null);
  if (lto.isValidAddress(addr)) {
    const msg = {
      transfer: {
        to: addr,
      },
    };
    const info = {
      sender: account.address,
      funds: [],
    };
    wasm.execute_contract(msg, info, ownable_id).then(
      (resp) => console.log(resp)
    )
  }
}

function initializePotionHTML(ownable_id, amount, color) {
  injectPotionToGrid(ownable_id, color);
  updateState(ownable_id, amount);
  const ownableHTML = document.getElementById(ownable_id);
  ownableHTML.getElementsByClassName("drink-button")[0]
    .addEventListener('click', () => consumeOwnable(ownable_id));
  ownableHTML.getElementsByClassName("transfer-button")[0]
    .addEventListener('click', () => transferOwnable(ownable_id));
}

function injectPotionToGrid(ownable_id, color) {
  const potionGrid = document.getElementsByClassName("grid-container")[0];
  const potionElement = document.createElement('div');
  potionElement.classList.add('grid-item');
  potionElement.innerHTML = getPotionTemplate(ownable_id);
  potionGrid.appendChild(potionElement);
  document.getElementById(ownable_id).getElementsByClassName('juice')[0].style.backgroundColor = color;
}

function getPotionTemplate(id) {
  return `<div id="${id}">
            <div class="potion">
              <img src="potion/back.png">
              <div class="juice"></div>
              <div class="under"></div>
              <img src="potion/glass.png">
              <img src="potion/body.png">
              <div class="amount"></div>
            </div>
            <div class="drink">
              <input type="range" min="1" max="100" value="50" class="slider">
              <button class="drink-button">Drink</button>
              <button class="transfer-button">Transfer</button>
            </div>
          </div>`
}

document.getElementsByClassName("inst-button")[0].addEventListener('click', () => issuePotion());
document.getElementsByClassName("sync-button")[0].addEventListener('click', () => syncDb(initializePotionHTML));
