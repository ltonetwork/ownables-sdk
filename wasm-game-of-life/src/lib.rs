mod utils;
use std::str;
use msg::EventBody;
use utils::MessageInfo;
use wasm_bindgen::prelude::*;
use js_sys::{Array, JSON};

pub mod msg;
pub mod state;
pub mod store;

use crate::state::State;
// use crate::msg::{CountResponse, ExecuteMsg, QueryMsg, InstantiateMsg};


#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn square(number: i32) -> i32 {
    alert("computing square...");
    number * number
}

#[wasm_bindgen]
pub fn compute_state(event_array: Array) -> String {
    let events_vec = event_array.to_vec();
    let mut event_msgs:Vec<EventBody> = Vec::new();

    // Check if all objects in the event_array are convertable to string
    for value in events_vec {

        let event_body = serde_wasm_bindgen::from_value(value).unwrap();
        event_msgs.push(event_body)
    };

    
    let mut state = State {count: 0 };
    // TODO: increment state from events
    for event in event_msgs {
        state.count += event.count;
    };


    // TODO: return State in a wasm_bindgen friendly manner
    return serde_json::to_string(&state).unwrap();
}


// pub fn instantiate(info: MessageInfo ,msg: InstantiateMsg) -> State {
//     // create an initial event for the eventchain
//     let state = State {
//         count: msg.count,
//     };

//     return state;
// }
