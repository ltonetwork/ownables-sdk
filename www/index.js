import * as wasm from "ownable-demo";

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
    .getElementsByClassName('drink-amount-slider')[0].valueOf().value;
  return parseInt(stringAmount);
}

function updateState(ownable_id, amt) {
  document.getElementById(ownable_id).getElementsByClassName('potion-juice')[0].style.top = (100 - amt) / 2 + '%';
  document.getElementById(ownable_id).getElementsByClassName('potion-amount')[0].textContent = amt;
}

function issuePotion(ownable_id) {
  wasm.instantiate_contract(100, ownable_id, "c-id-1").then(
    () => {
      console.log(document.getElementById(ownable_id).getElementsByClassName('juice'));
      document.getElementById(ownable_id).getElementsByClassName('juice')[0].style.backgroundColor = ownable_id;
      updateState(ownable_id, 100)
    }
  );
}

function initListenersForId(id) {
  document.getElementById(id)
    .getElementsByClassName("inst-button")[0]
    .addEventListener('click', () => issuePotion(id));
  document.getElementById(id)
    .getElementsByClassName("drink-button")[0]
    .addEventListener('click', () => consumePotion(id));
}

initListenersForId("darkred");
initListenersForId("darkblue");
initListenersForId("darkgreen");
initListenersForId("yellow");
initListenersForId("pink");
initListenersForId("white");
