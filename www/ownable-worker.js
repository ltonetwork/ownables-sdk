
addEventListener('message', async (e) => {
  if (wasm === undefined) {
    init(e.data).then(
      resp => {
        console.log(resp);
        let responseMsg = {
          success: true,
          msg: "WASM instantiated successfully",
        }
        self.postMessage(responseMsg);
      }
    );
  } else switch (e.data.type) {
    case "instantiate":
      instantiate_contract(e.data.msg, e.data.info).then(
        resp => {
          console.log("Contract instantiated successfully");
          self.postMessage(resp);
        }
      );
      break;
    case "execute":
      execute_contract(e.data.msg, e.data.info, e.data.ownable_id, e.data.idb).then(
        resp => {
          console.log("Contract executed successfully");
          self.postMessage(resp);
        }
      );
      break;
    case "query":
      query_contract_state(e.data.msg, e.data.idb).then(
        resp => {
          self.postMessage(resp);
        }
      );
      break;
    case "external_event":
      console.log("calling wasm with: ", e.data);
      register_external_event(e.data.msg.msg, e.data.msg.info, e.data.ownable_id, e.data.idb).then(
        resp => {
          console.log("External event registered");
          self.postMessage(resp);
        }
      );
      break;
    default:
      console.log("unknown message type");
      break;
  }
});

