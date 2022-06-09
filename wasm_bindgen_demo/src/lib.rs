use js_sys::{Function, Object, Reflect, WebAssembly};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::{spawn_local, JsFuture};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(a: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

const WASM: &[u8] = include_bytes!("add.wasm");
const WASM_LIB: &[u8] = include_bytes!("wasm_lib.wasm");

async fn run_async() -> Result<(), JsValue> {

    console_log!("instantiating a new wasm module directly");

    // basically WebAssembly.instantiate(), returns a promise of the instantiated wasm code
    let wasm_buffer = WebAssembly::instantiate_buffer(WASM, &Object::new());
    
    // a Rust future backed by a JS promise
    let a = JsFuture::from(wasm_buffer).await?;
    
    // works like getting a property from an object (target[propertyKey]) as a function
    /* e.g.
        const object1 = {
            x: 1,
            y: 2
        };
        console.log(Reflect.get(object1, 'x')); // 1
    */
    // returns the same instance as in frontend, that we would access by module.instance.exports.function_name
    let b: WebAssembly::Instance = Reflect::get(&a, &"instance".into())?.dyn_into()?;
    // grabs exports from module
    let c = b.exports();

    // dyn_into performs dynamic cast (checked at runtime) of this value into the target type T (Function in this case)
    // returns an Err(self) or Ok(T)
    let add = Reflect::get(c.as_ref(), &"add".into())?
        .dyn_into::<Function>()
        .expect("add export wasn't a function");

    // Function 
    let three = add.call2(&JsValue::undefined(), &1.into(), &2.into())?;
    console_log!("1 + 2 = {:?}", three);

    Ok(())
}

#[wasm_bindgen(start)]
pub fn run() {
    spawn_local(async {
        // return_string("from within run".to_string()).await;
        run_async().await.unwrap_throw();
    });
}

#[wasm_bindgen(js_namespace = console)]
pub async fn return_string(arg: String) -> Result<JsValue, JsValue> {
    
    console_log!("return_string called with arg {:?}", arg);
    let wasm_buffer = WebAssembly::instantiate_buffer(WASM_LIB, &Object::new());

    let a = JsFuture::from(wasm_buffer).await?;
    let b: WebAssembly::Instance = Reflect::get(&a, &"instance".into())?.dyn_into()?;
    let c = b.exports();

    let add = Reflect::get(c.as_ref(), &"add".into())?
        .dyn_into::<Function>()
        .expect("add export wasn't a function");
    
    let _three = add.call2(&JsValue::undefined(), &1.into(), &2.into())?;
    console_log!("1 + 2 = {:?}", _three);


    let greet = Reflect::get(c.as_ref(), &"greet".into())?
        .dyn_into::<Function>()
        .expect("add export wasn't a function");

    console_log!("about to call the greeting");
    let greeting = greet.call1(&JsValue::undefined(), &JsValue::from("test"))?;
    console_log!("greeting: {:?}", greeting);

    Ok(greeting)
}