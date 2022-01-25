
from wasmer import engine, Store, Module, Instance
from wasmer_compiler_cranelift import Compiler


wasm_bytes = open('../addr-contract/artifacts/addr_contract.wasm', 'rb').read()

store = Store(engine.JIT(Compiler))
module = Module(store=store, bytes=wasm_bytes)
instance = Instance(module)

result = instance.exports.instantiate_msg()
