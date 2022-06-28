import * as wasm from "ownable-demo";

$('#inst-button').on('click', function() {
  wasm.instantiate_contract(100, "0", "c-id-1").then(
    () => console.log("instantiated potion")
  );
});

$('#drink-button').on('click', function() {
  console.log("drinking 10 potion unit points");

  let msg = {
    "consume": {
      "amount": 20,
    },
  };
  wasm.execute_contract(msg, "0").then(
    () => console.log("consumed potion")
  );
});

$('#query-button').on('click', function() {
  console.log("querying contract state");
  let queryMsg = {
    "get_current_amount": {},
  };
  let result = wasm.query_contract_state("0").then(
    r => {
      console.log(r);
      return r;
    }
  );
  console.log(result);
});
