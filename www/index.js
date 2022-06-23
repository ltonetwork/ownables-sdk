import * as wasm from "ownable-demo";
import {Message} from "ownable-demo";

console.log(wasm.return_string());
console.log(wasm.add(4, 3));
console.log(wasm.concat_string('hi_'));

console.log("creating message");
let message = new Message(0, "hi");
console.log("message: ", message);
console.log(`msg: ${message.msg}, id: ${message.id}`);
