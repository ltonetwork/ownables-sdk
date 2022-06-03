#[no_mangle]
pub extern "C" fn age(cy: i32, yob: i32) -> i32 {
    cy - yob
}

// TODO: find alternative to wasm_bindgen to import functions
// pub fn exported_func() {
//    unsafe {
//       imported_func(500);
//    }
// }

// // #[wasm_bindgen]
// extern "C" {
//   fn imported_func(param: i32);
// }