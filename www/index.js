import * as wasm from "ownable-demo";
import {Message} from "ownable-demo";

console.log(`return_string(): ${wasm.return_string()}`);
console.log(`add(4, 3): ${wasm.add(4, 3)}`);
console.log(`concat_string(): ${wasm.concat_string("text")}`);

let message = new Message(0, "test-message");
console.log(`created message:`);
console.log(message);
console.log(`message.id: ${message.id}`);
console.log(`message.msg: ${message.msg}`);

console.log(`setting message.id = 1`);
message.id = 1;
console.log(`message.id: ${message.id}`);

console.log(`setting message.msg = different-message`);
message.msg = "different-message";
console.log(`message.msg: ${message.msg}`);
