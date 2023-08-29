## How to create a new execution message

### Update message file

You need to add your new message type to the message enum in the message.rs file.

```rust
#[ownables_transfer]
#[ownables_lock]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    MyCustomMessage {}
}
```

### Hande the new message

Next update the execution function inside of the contract.rs file

```rust
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Transfer { to } => try_transfer(info, deps, to),
        ExecuteMsg::Lock {} => try_lock(info, deps),
        ExecuteMsg::MyCustomMessage { } => handler(info, deps),
    }
}
```

### Create the handler

Create a new public function in the contract.rs file to handle the new message

```rust
pub fn handler(
    info: MessageInfo,
    deps: DepsMut,
) -> Result<Response, ContractError> {

    // Your Logic here

    return Ok(Response::new()
        .add_attribute("method", "mycustommessage")
        .add_attribute("status", "success")
    );

}
```

### Executing the message

In your frontend (asset.html), execute your new message using postMessage

```js
document.getElementById("myButton").addEventListener("click", function (event) {
  let msg = {
    mycustommessage: {},
  };

  window.parent.postMessage({ type: "execute", ownable_id, msg }, "*");
});
```
