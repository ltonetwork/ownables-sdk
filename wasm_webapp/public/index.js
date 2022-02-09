// This is a test to import wasm code into js and execute functions

import fs from 'fs'
// const fs = require('fs');
const mathwasm = fs.readFileSync('./math.wasm')

const math = await WebAssembly.instantiate(new Uint8Array(mathwasm)).
    then(res => res.instance.exports);

console.log(math.square(50));

var x = math.square(50);
console.log(x);