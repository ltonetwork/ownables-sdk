
import * as contract from "ownable-demo";
// import { AccountFactoryED25519 } from "@ltonetwork/lto/lib/accounts"
// import { Event } from  "@ltonetwork/lto/lib/events"
// import { EventChain } from  "@ltonetwork/lto/lib/events"
import { AccountFactoryED25519 } from "@ltonetwork/lto/raw/accounts"
import { Event } from  "@ltonetwork/lto/raw/events"
import { EventChain } from  "@ltonetwork/lto/raw/events"
import { storeOwnableId, getOwnableIds } from "./storage"

$('#test-button').on('click', function() {
    var input = $('#test-input').val();
    console.log(input);
    var result = contract.square(input);
    $('#result').text(result);
})

const OWNABLE_ID =  "test_ownable_1"
/**
 * Executes event on contract and on succes adds to chain and send transaction
 * [NOT FULLY FUNCTIONAL!]
 * @param {EventChain} chain
 * @param {LTOAccount} account
 * @param {int} count
 */
async function AddAndExecuteEvent(chain, account, count, _contract) {
    /* 
    This execution flow of the ownable interaction should be as follows:
        - create event in js
        - pass event/execute_msg to wasm
        - wasm should execute the contract
        - state should be properly(deterministically) mutated
        - if so, Add event to event chain
        - send lto transaction.
    */
    return new Promise((resolve, reject) => {

        console.log(`[execution 0/4] started execution`)
        // create event in js (i think only the msg is required at this point)
        // const event_msg = { increment: {by: count} }
        const event_msg = `{ "increment": { "by": ${count} }}`

        // pass event to wasm contract
        console.log(`[e 1/4] execute contract`);
        contract.execute_contract(JSON.parse(event_msg), OWNABLE_ID)
            .catch( error => {
                window.alert("An error occured during contract execution. State is reverted. Error: "+ error)
                reject(error)
            })
            .then( () => {
                // state should be mutated correctly now. -> create event
                console.log(`[e 2/4] create event`);
                const event = create_event(JSON.stringify(event_msg), account)

                console.log(`[e 3/4] add event to event chain`)
                chain.add(event)

                console.log(`[e 4/4] send LTO transaction`)
                console.log(`[warning] send lto tx not implemented`)
                // TODO: Ask arnold how to implement this for the demo
                // - which transaction do i use
                // - what data of the event/eventchain should i in the transaction
                resolve()
            })
    })
}

function RecreateStateFromChain(_chain, _contract) {
    /*
    This function should check the chain for the last event and see if that is also the last one executed by the contract.
    If not:
        - recreate state with events from chain
        - until last event
        - show last state and update user
    */
}



// seedphrase
// cherry glow move century meadow muffin grocery defy stomach blouse parade reject sphere mouse toddler
let account = new AccountFactoryED25519('T').createFromPrivateKey("4YQrHv8kNXc81sdCqPM4tPaWcfi8dMusKxdMYBcx8hkEKZ7GfreDgT74v6zGeWEPFtNWpeoQFZrJEzM3fzGdLeCk");

// creates event with specific event chain with id based on the key of account
// only use if you already have a eventchain
// const chain = new EventChain('JEKNVnkbo3jqSHT8tfiAKK4tQTFK7jbx8t18wEEnygya');

function instantiate_contract(_chain, ownable_id, count = 0) {
    contract.instantiate_contract(
        count,ownable_id, "test_contract_1"
    ).then(
        () => storeOwnableId(ownable_id)
    ).catch(
        error => window.alert(`error when instantiating contract ${error}`)
    )
}

function create_event(body, account) {
    return new Event(body).signWith(account)
}

// TODO: contract Increment message
function increment_contract(chain, count = 1) {
    // GET BODY MESSAGE FROM WASM
    const body = JSON.stringify({ increment: { count }})
    console.log(`[e 2/3] adding event to chain: ${body}`)

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
        .forEach( msg => contract.execute_contract(msg));

    // console.log(contract.query({ get_count: {} }));
    console.log(contract.query_state_contract(OWNABLE_ID));
}

function updateState() {
    contract.query_state_contract(OWNABLE_ID)
        .then(number => {
            console.log(`state from query: ${number}`)
            updateStateElement(number)
        })
}

function updateStateElement(state) {
    var target = document.querySelector("#event-current-state");
    var template = `<p>count: ~count~</p>`
    // target.innerHTML.replace()
    target.innerHTML = template.replace(/~count~/g, state)
}




const chain = account.createEventChain();
instantiate_contract(chain, OWNABLE_ID)
updateState()

function addItemToItemListHTML(item) {
    var target = document.querySelector("#past-events .list-group");
    var template = '<li class="list-group-item">~item~</li>';

    target.insertAdjacentHTML("beforeend", template.replace(/~item~/g, item));
}



$('#addr-button-inst').on('click', function() {

    var input = $('#input-inst').val();
    if(input == "") {
        return
    }

    // AddAndExecuteEvent(chain,account, input, "")
    AddAndExecuteEvent(chain,account, input, "")
        .then( () => {
            addItemToItemListHTML(JSON.stringify({ increment: { count: input }}));
            updateState()
        })


    // updateState()
    // $('#event-update:result').text(result);
})




// TODO: Initialize the eventchain in local store
// increment_contract(chain, 1)
// increment_contract(chain, 3)
// increment_contract(chain, 5)
// increment_contract(chain, 5)

// // NEXT TODO: Genesis event returned from contract
// // contract.instantiate(2)
// compute_state(chain)

// // should return JSobjact of state
// // const state = contract.query({ get_count: {} })
// const state = contract.query_state()
// console.log(state)

// NEXT TODO: contract inladen in functie
// NEXT TODO: use js schemas

/*

Make ownable object with eventchain
contract should be in the genesis event
with OOP 
so al the functions, instantiate contract, execute contract, query contract are methods 
*/
