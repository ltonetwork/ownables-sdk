function getImports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbindgen_json_serialize = function(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = JSON.stringify(obj === undefined ? null : obj);
    const ptr0 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len0;
    getInt32Memory0()[arg0 / 4 + 0] = ptr0;
  };
  imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbindgen_cb_drop = function(arg0) {
    const obj = takeObject(arg0).original;
    if (obj.cnt-- == 1) {
      obj.a = 0;
      return true;
    }
    const ret = false;
    return ret;
  };
  imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_json_parse = function(arg0, arg1) {
    const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_put_992c0312af1a472a = function(arg0, arg1, arg2, arg3, arg4) {
    const ret = getObject(arg0).put(getArrayU8FromWasm0(arg1, arg2), getArrayU8FromWasm0(arg3, arg4));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_log_64ee15350ef2569b = function(arg0, arg1) {
    console.log(getStringFromWasm0(arg0, arg1));
  };
  imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_getallidbkeys_32db68c78ae6bce8 = function(arg0) {
    const ret = getObject(arg0).get_all_idb_keys();
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_get_e7a84782c708ea1e = function(arg0, arg1, arg2) {
    const ret = getObject(arg0).get(getArrayU8FromWasm0(arg1, arg2));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_get_f0f4f1608ebf633e = function(arg0, arg1) {
    const ret = getObject(arg0)[arg1 >>> 0];
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_length_93debb0e2e184ab6 = function(arg0) {
    const ret = getObject(arg0).length;
    return ret;
  };
  imports.wbg.__wbg_call_9855a4612eb496cb = function() { return handleError(function (arg0, arg1, arg2) {
    const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
    return addHeapObject(ret);
  }, arguments) };
  imports.wbg.__wbg_buffer_de1150f91b23aa89 = function(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_new_78403b138428b684 = function(arg0, arg1) {
    try {
      var state0 = {a: arg0, b: arg1};
      var cb0 = (arg0, arg1) => {
        const a = state0.a;
        state0.a = 0;
        try {
          return __wbg_adapter_40(a, state0.b, arg0, arg1);
        } finally {
          state0.a = a;
        }
      };
      const ret = new Promise(cb0);
      return addHeapObject(ret);
    } finally {
      state0.a = state0.b = 0;
    }
  };
  imports.wbg.__wbg_resolve_f269ce174f88b294 = function(arg0) {
    const ret = Promise.resolve(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_then_1c698eedca15eed6 = function(arg0, arg1) {
    const ret = getObject(arg0).then(getObject(arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_then_4debc41d4fc92ce5 = function(arg0, arg1, arg2) {
    const ret = getObject(arg0).then(getObject(arg1), getObject(arg2));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_new_97cf52648830a70d = function(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_set_a0172b213e2469e9 = function(arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
  };
  imports.wbg.__wbg_length_e09c0b925ab8de5d = function(arg0) {
    const ret = getObject(arg0).length;
    return ret;
  };
  imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
    const ret = debugString(getObject(arg1));
    const ptr0 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len0;
    getInt32Memory0()[arg0 / 4 + 0] = ptr0;
  };
  imports.wbg.__wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  imports.wbg.__wbindgen_memory = function() {
    const ret = wasm.memory;
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_closure_wrapper181 = function(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 71, __wbg_adapter_20);
    return addHeapObject(ret);
  };

  return imports;
}

self.addEventListener("message", (m) => {
  console.log("received message in worker: ", m.data);
  const imports = getImports();
  let importObj = Object.assign(imports.wbg);
  let serializedImportObj = {};
  for (let funcName in importObj) {
    const func = importObj[funcName];
    const funcString = func.toString();
    const body = funcString.slice(funcString.indexOf("{") + 1, funcString.lastIndexOf('}'));
    const args = funcString.slice(funcString.indexOf("(") + 1, funcString.indexOf(")"));
    const functionDefinition = {
      "arguments": args,
      "body": body,
    };
    serializedImportObj[funcName] = functionDefinition;
  }

  postMessage({type: "importObj", serializedImportObj});
});
