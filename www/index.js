import * as wasm from "ownable-demo";
import {Event, EventChain} from "@ltonetwork/lto/lib/events"
import {
  syncDb,
} from "./event-chain";

import {consumeOwnable, issueOwnable, transferOwnable} from "./wasm-wrappers";

syncDb(initializePotionHTML)
  .then(() => console.log("sync complete"));

// if no chainIds found, init empty
if (localStorage.getItem("chainIds") === null) {
  localStorage.chainIds = JSON.stringify([]);
}

export function getDrinkAmount(ownable_id) {
  let stringAmount = document.getElementById(ownable_id)
    .getElementsByClassName('slider')[0].valueOf().value;
  return parseInt(stringAmount);
}

export function updateState(ownable_id, amt) {
  document.getElementById(ownable_id).getElementsByClassName('juice')[0].style.top = (100 - amt) / 2 + '%';
  document.getElementById(ownable_id).getElementsByClassName('amount')[0].textContent = amt;
}

export function initializePotionHTML(ownable_id, amount, color) {
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

document.getElementsByClassName("inst-button")[0].addEventListener('click', () => issueOwnable());
