import * as contract from "wasm-game-of-life";
// import * as contract from "addr-contract";

// wasm.greet();

$('#test-button').on('click', function() {
    var input = $('#test-input').val();
    console.log(input);
    var result = contract.square(input);
    $('#result').text(result);
})


const factory = require('@ltonetwork/lto').AccountFactoryED25519;
const EventChain = require('lto-api').EventChain;
const Event = require('lto-api').Event;


// seedphrase
// cherry glow move century meadow muffin grocery defy stomach blouse parade reject sphere mouse toddler
let account = new factory('T').createFromPrivateKey("4YQrHv8kNXc81sdCqPM4tPaWcfi8dMusKxdMYBcx8hkEKZ7GfreDgT74v6zGeWEPFtNWpeoQFZrJEzM3fzGdLeCk");

// creates event with specific event chain with id based on the key of account
// only use if you already have a eventchain
// const chain = new EventChain('JEKNVnkbo3jqSHT8tfiAKK4tQTFK7jbx8t18wEEnygya');

// from scratch for this account

// TODO: contract Increment message
function increment_contract(chain, count = 1) {
   // GET BODY MESSAGE FROM WASM
    const body = JSON.stringify({Increment: { count }})

    chain.addEvent(new Event(body).signWith(account));
}

// TODO: contract reset message
function reset_contract(chain, count = 0) {
   // GET BODY MESSAGE FROM WASM
    const body = JSON.stringify({Reset: { count }})

    chain.addEvent(new Event(body).signWith(account));
}

// TODO: contract.execute
function compute_state(contract, chain) {
    // array of event bodies(JSON string)
    chain.events
        .map(event => JSON.parse(event.body) )
        .forEach( msg => contract.execute(msg) );

    console.log(contract.query({GetCount: {} }));
}
    
const chain = account.newEventChain();

increment_contract(chain, 1)
increment_contract(chain, 3)
increment_contract(chain, 5)
increment_contract(chain, 5)

// NEXT TODO: Genesis event returned from contract
contract.instantiate(2)
compute_state(contract, chain)

// should return JSobjact of state
const state = contract.get_state()
console.log(state)


// NEXT TODO: contract inladen in functie