import * as wasm from "ownable-demo";
import {Event, EventChain} from "@ltonetwork/lto/lib/events"

import {LTO} from '@ltonetwork/lto';

const lto = new LTO('T');
const account = lto.account();

// if no chainIds found, init empty
if (localStorage.getItem("chainIds") === null) {
  localStorage.chainIds = JSON.stringify([]);
}

function queryState(ownable_id) {
  wasm.query_contract_state(ownable_id).then(
    potion => {
      updateState(ownable_id, potion.current_amount);
      return potion.current_amount;
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
      let newEvent = chain.add(new Event({"@context": "execute_msg.json", ...msg})).signWith(account);
      writeEventObjToIDB(newEvent, ownable_id);
      queryState(ownable_id);
    },
    (err) => window.alert("attempting to consume more than possible")
  );
}

function deriveStateFromEventChain(ownable_id) {
  if (!window.indexedDB) {
    console.log("Your browser doesn't support a stable version of IndexedDB.");
  }
  let chain = new EventChain('');
  const request = window.indexedDB.open(ownable_id);
  request.onerror = event => console.log("Can't use IndexedDB");
  request.onsuccess = event => {
    const db = event.target.result;
    const tx = db.transaction("events");
    const objectStore = tx.objectStore("events");
    objectStore.getAll()
      .onsuccess = event => {
        let latestEvent = { timestamp: 0 };
        event.target.result.forEach(
          e => {
            e = JSON.parse(e);
            if (e.timestamp > latestEvent.timestamp) {
              latestEvent = e;
            }
          }
        )
        chain.set(latestEvent);
    };
  };
  return chain;
}

function writeEventObjToIDB(eventObj, ownable_id) {
  if (!window.indexedDB) {
    console.log("Your browser doesn't support a stable version of IndexedDB.");
  }

  const request = window.indexedDB.open(ownable_id);
  request.onerror = () => console.error("Can't use IndexedDB");
  request.onsuccess = event => {
    const db = event.target.result;
    db.transaction("events", "readwrite")
      .objectStore("events")
      .put(JSON.stringify(eventObj), eventObj['_hash'])
      .onsuccess = event => {
        console.log("event written to db: ", eventObj)
    };
  };
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
      let newEvent = chain.add(new Event({"@context": "instantiate_msg.json", ...msg})).signWith(account);
      writeEventObjToIDB(newEvent, msg.ownable_id);
      initializePotionHTML(msg.ownable_id, 100);
    },
    (err) => window.alert("failed to instantiate contract")
  );
}



function initializePotionHTML(ownable_id, amount) {
  injectPotionToGrid(ownable_id);
  updateState(ownable_id, amount);
  initListenersForId(ownable_id);
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
    let potionResponse = wasm.query_contract_state(chainIds[i]).then(
      (resp) => {
        console.log(resp);
        if (document.getElementById(chainIds[i]) === null) {
          initializePotionHTML(chainIds[i], resp.current_amount);
        } else {
          console.log('potion already initialized');
        }
      },
      (err) => console.log("something went wrong")
    );

  }
}
