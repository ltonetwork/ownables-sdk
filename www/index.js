import * as wasm from "ownable-demo";
import {Event, EventChain} from "@ltonetwork/lto/lib/events"

import {LTO} from '@ltonetwork/lto';

const lto = new LTO('T');
const account = lto.account();
// IDB
let db;

function queryState(ownable_id) {
  wasm.query_contract_state(ownable_id).then(
    amt => {
      updateState(ownable_id, amt);
      return amt;
    }
  );
}

function consumePotion(ownable_id) {
  let msg = {
    "consume": {
      "amount": getDrinkAmount(ownable_id),
    },
  };

  let chain = deriveStateFromEventChain(ownable_id);
  wasm.execute_contract(msg, ownable_id).then(
    () => {
      chain.add(new Event({"@context": "execute_msg.json", ...msg})).signWith(account);
      localStorage.setItem(ownable_id, JSON.stringify(chain));
      queryState(ownable_id);
    },
    (err) => window.alert("attempting to consume more than possible")
  );
}

function deriveStateFromEventChain(ownable_id) {
  let data = JSON.parse(localStorage.getItem(ownable_id));
  const chain = new EventChain('');
  chain.set(data);

  console.log("deriving state for ", chain);
  chain.events.forEach(
    e => {
      console.log(e.getBody());
    }
  )
  return chain
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
  syncDb().then(() => console.log('synced'));
  // issue a new event chain
  const chain = EventChain.create(account);
  const msg = {
    max_capacity: 100,
    ownable_id: chain.id,
    contract_id: "c-id-1",
  };

  wasm.instantiate_contract(msg).then(
    () => {
      // add the event to chain and store in local storage
      chain.add(new Event({"@context": "instantiate_msg.json", ...msg}).signWith(account));
      localStorage.setItem(msg.ownable_id, JSON.stringify(chain));
      // injects element into html
      injectPotionToGrid(msg.ownable_id);
      updateState(msg.ownable_id, 100);
      initListenersForId(msg.ownable_id);
    },
    (err) => window.alert("failed to instantiate contract")
  );
}

function injectPotionToGrid(ownable_id) {
  const potionGrid = document.getElementsByClassName("grid-container")[0];
  const potionElement = document.createElement('div');
  potionElement.classList.add('grid-item');
  potionElement.innerHTML = getPotionTemplate(ownable_id);
  potionGrid.appendChild(potionElement);

  document.getElementById(ownable_id).getElementsByClassName('juice')[0].style.backgroundColor =
    `#${Math.floor(Math.random() * 16777215).toString(16)}`;
}

function initListenersForId(id) {
  document.getElementById(id).getElementsByClassName("drink-button")[0]
    .addEventListener('click', () => consumePotion(id));
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
            </div>
          </div>`
}

document.getElementsByClassName("inst-button")[0].addEventListener('click', () => issuePotion());

async function syncDb() {

  const DBOpenRequest = window.indexedDB.open("event-chain");

  DBOpenRequest.onerror = function(event) {
    console.log('Error loading database');
    return -1;
  };

  DBOpenRequest.onsuccess = function(event) {
    console.log('Database initialized.');
    db = DBOpenRequest.result;
  };
}
