// TODO: dynamically join this with the bg glue-code to pass it to worker
onmessage = async (e) => {
  let resp, message;
  console.log("worked picked up message:");
  console.log(e);
  switch (e.data.type) {
    case "instantiate":
      resp = await instantiate_contract(e.data.msg, e.data.info, e.data.idb);
      message = "Contract instantiated successfully";
      break;
    case "execute":
      resp = await execute_contract(e.data.msg, e.data.info, e.data.ownable_id, e.data.idb);
      message = "Contract executed successfully";
      break;
    case "query":
      resp = await query_contract_state(e.data.msg, e.data.info, e.data.idb);
      message = "Contract queried successfully";
      break;
    default:
      resp = "unknown message type";
      break;
  }
  console.log(resp);
  postMessage(message, resp);
}
