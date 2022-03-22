import * as contract from "wasm-game-of-life";
import { AccountFactoryED25519 } from "@ltonetwork/lto/raw/accounts"
import { Event } from  "@ltonetwork/lto/raw/events"
import { EventChain } from  "@ltonetwork/lto/raw/events"
// import * as contract from "addr-contract";

contract.initialize()
// wasm.greet();

$('#test-button').on('click', function() {
    var input = $('#test-input').val();
    console.log(input);
    var result = contract.square(input);
    $('#result').text(result);
})


// seedphrase
// cherry glow move century meadow muffin grocery defy stomach blouse parade reject sphere mouse toddler
let account = new AccountFactoryED25519('T').createFromPrivateKey("4YQrHv8kNXc81sdCqPM4tPaWcfi8dMusKxdMYBcx8hkEKZ7GfreDgT74v6zGeWEPFtNWpeoQFZrJEzM3fzGdLeCk");

// creates event with specific event chain with id based on the key of account
// only use if you already have a eventchain
// const chain = new EventChain('JEKNVnkbo3jqSHT8tfiAKK4tQTFK7jbx8t18wEEnygya');

// TODO: contract Increment message
function increment_contract(chain, count = 1) {
   // GET BODY MESSAGE FROM WASM
    const body = JSON.stringify({ increment: { count }})
    console.log(body)

    chain.add(new Event(body).signWith(account));
}
// TODO: contract reset message
function reset_contract(chain, count = 0) {
   // GET BODY MESSAGE FROM WASM
    const body = JSON.stringify({Reset: { count }})

    chain.add(new Event(body).signWith(account));
}

// TODO: contract.execute
function compute_state(chain) {
    // array of event bodies(JSON string)
    chain.events
        .map(event => JSON.parse(event.getBody()))
        .forEach( msg => contract.execute(msg) );

    // console.log(contract.query({ get_count: {} }));
    console.log(contract.query_state());
}
    
const chain = account.createEventChain();
increment_contract(chain, 1)
increment_contract(chain, 3)
increment_contract(chain, 5)
increment_contract(chain, 5)

// NEXT TODO: Genesis event returned from contract
// contract.instantiate(2)
compute_state(chain)

// should return JSobjact of state
// const state = contract.query({ get_count: {} })
const state = contract.query_state()
console.log(state)


// NEXT TODO: contract inladen in functie
// NEXT TODO: use js schemas
