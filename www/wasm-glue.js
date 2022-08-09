
let wasm;
let importObject;

const heap = new Array(32).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) { return heap[idx]; }

let WASM_VECTOR_LEN = 0;

let cachedUint8Memory0;
function getUint8Memory0() {
  if (cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}

const cachedTextEncoder = new TextEncoder('utf-8');

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
  ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
  }
  : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  });

function passStringToWasm0(arg, malloc, realloc) {

  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length);
    getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len);

  const mem = getUint8Memory0();

  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7F) break;
    mem[ptr + offset] = code;
  }

  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3);
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);

    offset += ret.written;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

let cachedInt32Memory0;
function getInt32Memory0() {
  if (cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}

let heap_next = heap.length;

function dropObject(idx) {
  if (idx < 36) return;
  heap[idx] = heap_next;
  heap_next = idx;
}

function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}

const cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

function getStringFromWasm0(ptr, len) {
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];

  heap[idx] = obj;
  return idx;
}

function debugString(val) {
  // primitive types
  const type = typeof val;
  if (type == 'number' || type == 'boolean' || val == null) {
    return  `${val}`;
  }
  if (type == 'string') {
    return `"${val}"`;
  }
  if (type == 'symbol') {
    const description = val.description;
    if (description == null) {
      return 'Symbol';
    } else {
      return `Symbol(${description})`;
    }
  }
  if (type == 'function') {
    const name = val.name;
    if (typeof name == 'string' && name.length > 0) {
      return `Function(${name})`;
    } else {
      return 'Function';
    }
  }
  // objects
  if (Array.isArray(val)) {
    const length = val.length;
    let debug = '[';
    if (length > 0) {
      debug += debugString(val[0]);
    }
    for(let i = 1; i < length; i++) {
      debug += ', ' + debugString(val[i]);
    }
    debug += ']';
    return debug;
  }
  // Test for built-in
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
  let className;
  if (builtInMatches.length > 1) {
    className = builtInMatches[1];
  } else {
    // Failed to match the standard '[object ClassName]'
    return toString.call(val);
  }
  if (className == 'Object') {
    // we're a user defined class or Object
    // JSON.stringify avoids problems with cycles, and is generally much
    // easier than looping through ownProperties of `val`.
    try {
      return 'Object(' + JSON.stringify(val) + ')';
    } catch (_) {
      return 'Object';
    }
  }
  // errors
  if (val instanceof Error) {
    return `${val.name}: ${val.message}\n${val.stack}`;
  }
  // TODO we could test for more things here, like `Set`s and `Map`s.
  return className;
}

function makeMutClosure(arg0, arg1, dtor, f) {
  const state = { a: arg0, b: arg1, cnt: 1, dtor };
  const real = (...args) => {
    // First up with a closure we increment the internal reference
    // count. This ensures that the Rust closure environment won't
    // be deallocated while we're invoking it.
    state.cnt++;
    const a = state.a;
    state.a = 0;
    try {
      return f(a, state.b, ...args);
    } finally {
      if (--state.cnt === 0) {
        wasm.__wbindgen_export_2.get(state.dtor)(a, state.b);

      } else {
        state.a = a;
      }
    }
  };
  real.original = state;

  return real;
}
function __wbg_adapter_20(arg0, arg1, arg2) {
  wasm._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hba6c21f489c842e9(arg0, arg1, addHeapObject(arg2));
}

function getArrayU8FromWasm0(ptr, len) {
  return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
}
/**
 * @param {any} msg
 * @param {any} info
 * @param {any} idb
 * @returns {Promise<any>}
 */
export function instantiate_contract(msg, info, idb) {
  const ret = wasm.instantiate_contract(addHeapObject(msg), addHeapObject(info), addHeapObject(idb));
  return takeObject(ret);
}

/**
 * @param {any} msg
 * @param {any} info
 * @param {string} ownable_id
 * @param {any} idb
 * @returns {Promise<any>}
 */
export function execute_contract(msg, info, ownable_id, idb) {
  const ptr0 = passStringToWasm0(ownable_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.execute_contract(addHeapObject(msg), addHeapObject(info), ptr0, len0, addHeapObject(idb));
  return takeObject(ret);
}

/**
 * @param {any} idb
 * @returns {Promise<any>}
 */
export function query_contract_state(idb) {
  const ret = wasm.query_contract_state(addHeapObject(idb));
  return takeObject(ret);
}

function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_exn_store(addHeapObject(e));
  }
}
function __wbg_adapter_40(arg0, arg1, arg2, arg3) {
  wasm.wasm_bindgen__convert__closures__invoke2_mut__h2ee9a5ac7f5ecbea(arg0, arg1, addHeapObject(arg2), addHeapObject(arg3));
}

async function load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {

      try {
        return await WebAssembly.instantiateStreaming(module, imports);

      } catch (e) {
        if (module.headers.get('Content-Type') != 'application/wasm') {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);

  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}

function initMemory(imports, maybe_memory) {

}

function finalizeInit(instance, module) {
  wasm = instance.exports;
  init.__wbindgen_wasm_module = module;
  cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);


  return wasm;
}

function getImports() {
  return importObject;
}

function initSync(bytes) {
  const imports = getImports();

  initMemory(imports);

  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, imports);

  return finalizeInit(instance, module);
}

async function init(input, importsURL) {
  return new Promise((resolve, reject) => {
    if (typeof input === 'undefined') {
      reject("no wasm found");
    } else if (typeof importsURL === 'undefined') {
      reject("no import object URL found");
    }

    if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
      input = fetch(input);
    }

    const myWorker = new Worker(importsURL);
    myWorker.addEventListener("message", async (m) => {
      // override the default importObject with the imported one
      importObject = {
        wbg: deserializeImportObject(m.data.serializedImportObj)
      };
      console.log("deserialized import object: ", importObject);

      initMemory(importObject);

      const {instance, module} = await load(await input, importObject);
      await finalizeInit(instance, module);
      resolve(wasm);
    });
    myWorker.postMessage({"type": "getImports"});
  });
}


function deserializeImportObject(importObj) {
  let importFunctions = {};
  for (let funcName in importObj) {
    const func = importObj[funcName];
    const importFunction = new Function(
      func.arguments,
      func.body,
    );
    importFunctions[funcName] = importFunction;
  }
  return importFunctions;
}

export { initSync }
export default init;
