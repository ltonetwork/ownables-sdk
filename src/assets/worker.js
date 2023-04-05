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
      e.data.msg.nft = (!e.data.msg.nft) ? undefined : e.data.msg.nft;
      e.data.msg.ownable_type = (!e.data.msg.ownable_type) ? undefined : e.data.msg.ownable_type;
      e.data.msg.network_id = e.data.msg.network_id.charCodeAt(0);
      instantiate_contract(e.data.msg, e.data.info)
        .then(resp => self.postMessage(resp))
        .catch(err => self.postMessage({err}));
      break;
    case "execute":
      execute_contract(e.data.msg, e.data.info, e.data.mem)
        .then(resp => self.postMessage(resp))
        .catch(err => self.postMessage({err}));
      break;
    case "external_event":
      const messageInfo = e.data.info;
      register_external_event(e.data.msg.msg, messageInfo.info, e.data.ownable_id, e.data.mem)
        .then(resp => self.postMessage(resp))
        .catch(err => self.postMessage({err}));
      break;
    case "query":
      query_contract_state(e.data.msg, e.data.mem)
        .then(resp => self.postMessage(resp))
        .catch(err => self.postMessage({err}));
      break;
    default:
      self.postMessage({err: `unknown message type ${e.data.type}`});
      break;
  }
});
