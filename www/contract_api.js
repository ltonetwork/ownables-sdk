function instantiate_contract(_chain, ownable_id, count=0, contract) {
    contract.instantiate_contract(count,ownable_id, "test_contract_1")
    .then( () => {
        storeOwnableId(ownable_id)
        return
    })
    .catch( error => {
        window.alert(`error when instantiating contract ${error}`)
    })
}

function create_event(body, account) {
    return new Event(body).signWith(account)
}

// TODO: contract Increment message
function increment_contract(chain, count = 1, contract) {
   // GET BODY MESSAGE FROM WASM
    const body = JSON.stringify({ increment: { count }})
    console.log(`[e 2/3] adding event to chain: ${body}`)

    chain.add(new Event(body).signWith(account));
}




// TODO: contract reset message
function reset_contract(chain, count = 0, contract) {
   // GET BODY MESSAGE FROM WASM
    const body = JSON.stringify({Reset: { count }})

    chain.add(new Event(body).signWith(account));
}

// TODO: contract.execute
function compute_state(chain, contract) {
    // array of event bodies(JSON string)
    chain.events
        .map(event => JSON.parse(event.getBody()))
        .forEach( msg => contract.execute_contract(msg));

    // console.log(contract.query({ get_count: {} }));
    console.log(contract.query_state_contract(OWNABLE_ID));
}

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
        _contract.execute_contract(JSON.parse(event_msg), OWNABLE_ID)
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
