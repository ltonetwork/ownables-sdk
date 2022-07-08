import * as wasm from "ownable-demo";
import {Event, EventChain} from "@ltonetwork/lto/lib/events"

import {LTO} from '@ltonetwork/lto';

const lto = new LTO('T');
const account = lto.account();
// IDB
let dbs = {};

// if no chainIds found, init empty
if (localStorage.getItem("chainIds") === null) {
  localStorage.chainIds = JSON.stringify([]);
}



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
  // issue a new event chain
  const chain = EventChain.create(account);
  const msg = {
    max_capacity: 100,
    ownable_id: chain.id,
    contract_id: "c-id-1",
  };

  let chainIds = JSON.parse(localStorage.chainIds);
  chainIds.push(msg.ownable_id);
  localStorage.chainIds = JSON.stringify(chainIds);


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
document.getElementsByClassName("sync-button")[0].addEventListener('click', () => syncDb());

async function syncDb() {

  if (!window.indexedDB) {
    console.log("Your browser doesn't support a stable version of IndexedDB.");
  }

  const chainIds = JSON.parse(localStorage.chainIds);
  console.log("chainIds: ", chainIds);

  for (let i = 0; i < chainIds.length; i++) {
    const request = window.indexedDB.open(chainIds[i]);

    request.onerror = errorEvent => console.log('Error loading database', request.result);

    request.onsuccess = successEvent => {
      const db = request.result
      dbs[chainIds[i]] = db;
      console.log("querying db:");
      db.transaction("state")
        .objectStore("state")
        .getAll()
        .onsuccess = event => {
          console.log("state: ", event.target.result);
        };
    };
  }

}
