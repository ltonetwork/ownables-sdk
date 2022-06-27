import * as wasm from "./ownable_demo_bg.wasm";

let WASM_VECTOR_LEN = 0;

// numeric values mapping to specific characters <-> utf8 byte stream converters
const lTextEncoder = typeof TextEncoder === 'undefined' ?
    (0, module.require)('util').TextEncoder : TextEncoder;
const lTextDecoder = typeof TextDecoder === 'undefined' ?
    (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextEncoder = new lTextEncoder('utf-8');
let cachedTextDecoder = new lTextDecoder(
    'utf-8',
    { ignoreBOM: true, fatal: true }
);

// wasm mem access
let cachedUint8Memory0;
function getUint8Memory0() {
    if (cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

let cachedInt32Memory0;
function getInt32Memory0() {
    if (cachedInt32Memory0.byteLength === 0) {
        cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32Memory0;
}


function getStringFromWasm0(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

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

// rust function (re-)exports
export function add(a, b) {
    return wasm.add(a, b);
}

export function return_string() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.return_string(retptr);
        var r0 = getInt32Memory0()[retptr / 4];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        return getStringFromWasm0(r0, r1);
    } catch {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_free(r0, r1);
    }

}

export function concat_string(name) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.concat_string(retptr, ptr0, len0);
        var r0 = getInt32Memory0()[retptr / 4];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_free(r0, r1);
    }
}

// class definitions
export class Message {

    constructor(id, msg) {
        const ptr0 = passStringToWasm0(msg, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.message_new(id, ptr0, len0);
        return Message.__wrap(ret);
    }

    static __wrap(ptr) {
        const obj = Object.create(Message.prototype);
        obj.ptr = ptr;

        return obj;
    }

    get id() {
        const ret = wasm.__wbg_get_message_id(this.ptr);
        return ret;
    }

    set id(arg) {
        wasm.__wbg_set_message_id(this.ptr, arg);
    }

    get msg() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.message_msg(retptr, this.ptr);
            var r0 = getInt32Memory0()[retptr / 4];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(r0, r1);
        }
    }

    set msg(arg) {
        const ptr0 = passStringToWasm0(arg, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.message_set_msg(this.ptr, ptr0, len0);
    }

}


// init memory
cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);

