mod utils;
use std::str;
use msg::EventBody;
use utils::MessageInfo;
use wasm_bindgen::prelude::*;
use js_sys::{Array, JSON};

pub mod msg;
pub mod state;

use crate::state::{State};
use crate::msg::{CountResponse, ExecuteMsg, QueryMsg, InstantiateMsg};



// use crate::msg::{CountResponse, ExecuteMsg, InstantiateMsg, QueryMsg};

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
// #[cfg(feature = "wee_alloc")]
// #[global_allocator]
// static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn square(number: i32) -> i32 {
    alert("computing square...");
    number * number
}

// #[wasm_bindgen]
pub fn compute_state(event_array: Array) -> State {
    let events_vec = event_array.to_vec();
    let event_msgs:Vec<EventBody> = Vec::new();

    // Check if all objects in the event_array are convertable to string
    for i in events_vec {
        let eventBody = EventBody::from(i.as_string());
        event_msgs.push(eventBody)
    };

    // TODO: increment state from events

    // TODO: return State in a wasm_bindgen friendly manner
    
}


pub fn instantiate(info:MessageInfo ,msg: InstantiateMsg) -> State {
    // create an initial event for the eventchain
    let state = State {
        count: msg.count,
        owner: info.sender,
    };

    return state;
}


pub struct ev