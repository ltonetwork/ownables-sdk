import * as wasm from "../pkg/ownable_demo_bg.wasm";

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

