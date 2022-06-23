mod utils;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Message {
    pub id: i32,
    msg: String,
}

#[wasm_bindgen]
impl Message {

    #[wasm_bindgen(constructor)]
    pub fn new(id: i32, msg: String) -> Message {
        Message{ id, msg }
    }

    #[wasm_bindgen(setter)]
    pub fn set_msg(&mut self, msg: String) {
        self.msg = msg;
    }

    #[wasm_bindgen(getter)]
    pub fn msg(&self) -> String {
        self.msg.clone()
    }
}

#[wasm_bindgen]
pub fn add(a: u32, b: u32) -> u32 {
    a + b
}

#[wasm_bindgen]
pub fn return_string() -> String {
    "lto".to_string()
}

#[wasm_bindgen]
pub fn concat_string(name: String) -> String {
    format!("hello {:?}", name).into()
}

#[wasm_bindgen]
pub fn create_message(id: i32, msg: String) -> Message {
    Message { id, msg }
}

#[wasm_bindgen]
pub fn change_message(mut msg: Message, new_msg: String) -> Message {
    msg.set_msg(new_msg);
    msg
}