import * as wasm from "ownable-demo";

function queryState() {
  wasm.query_contract_state("0").then(
    amt => {
      updateState(amt);
      return amt;
    }
  );
}

function consumePotion() {
  let msg = {
    "consume": {
      "amount": getDrinkAmount(),
    },
  };
  wasm.execute_contract(msg, "0").then(
    () => queryState(),
    (err) => window.alert("attempting to consume more than possible")
  );
}

function getDrinkAmount() {
  let stringAmount = document.getElementById('drink-amount-slider').valueOf().value;
  return parseInt(stringAmount);
}

function updateState(amt) {
  document.getElementById('potion-juice').style.top = (100 - amt) / 2 + '%';
  document.getElementById('potion-amount').textContent = amt;
}

function issuePotion() {
  wasm.instantiate_contract(100, "0", "c-id-1").then(
    () => console.log("instantiated potion")
  );
}

document.getElementById('inst-button').addEventListener('click', issuePotion);
document.getElementById('drink').addEventListener('click', consumePotion);
