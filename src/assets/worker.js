// This file is appended to bindgen.js from the ownable package. It allows the ownable iframe to message the worker.

addEventListener('message', (e) => {
  if (wasm === undefined) {
    init(e.data).then(
      () => {
        let responseMsg = {
          success: true,
          msg: "WASM instantiated successfully",
        }
        self.postMessage(responseMsg);
      }
    );

    return;
  }

  switch (e.data.type) {
    case "instantiate":
      instantiate_contract(e.data.msg, e.data.info)
        .then(resp => self.postMessage(resp))
        .catch(err => self.postMessage({err}));
      break;
    case "execute":
      execute_contract(e.data.msg, e.data.info, e.data.ownable_id, e.data.idb)
        .then(resp => self.postMessage(resp))
        .catch(err => self.postMessage({err}));
      break;
    case "external_event":
      register_external_event(e.data.msg.msg, e.data.msg.info, e.data.ownable_id, e.data.idb)
        .then(resp => self.postMessage(resp))
        .catch(err => self.postMessage({err}));
      break;
    case "query":
      query_contract_state(e.data.msg, e.data.idb)
        .then(resp => self.postMessage(resp))
        .catch(err => self.postMessage({err}));
      break;
    default:
      self.postMessage({err: `unknown message type ${e.data.type}`});
      break;
  }
});
