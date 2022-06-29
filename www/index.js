import * as wasm from "ownable-demo";
import {Event, EventChain} from "@ltonetwork/lto/lib/events"

import {LTO} from '@ltonetwork/lto';

const lto = new LTO('T');
const account = lto.account();

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
  wasm.execute_contract(msg, ownable_id).then(
    () => queryState(ownable_id),
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
    contract_id: "c-id-1",
  };

  wasm.instantiate_contract(msg).then(
    () => {
      // add the event to chain
      chain.add(new Event({"@context": "instantiate_msg.json", ...msg}).signWith(account));
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
