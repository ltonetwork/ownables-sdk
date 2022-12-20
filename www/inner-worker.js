import {updateState} from "./index";

let worker;

addEventListener('message', async (e) => {
  let args = e.data.args;
  switch (e.data.method) {
    case "initWorker":
      await initWorker(args[0], args[1], args[2]);
      break;
    case "instantiateOwnable":
      await issueOwnable(args[0], args[1], args[2]);
      break;
    case "executeOwnable":
      await executeOwnable(args[0], args[1]);
      break;
    case "transferOwnable":
      await transferOwnable(args[0], args[1], args[2], args[3]);
      break;
    case "queryState":
      await queryState(args[0], args[1], args[2]);
      break;
    case "queryMetadata":
      await queryMetadata(args[0], args[1], args[2]);
      break;
    default:
      break;
  }
});

export async function initWorker(ownableId, javascript, wasm) {
  return new Promise(async (resolve, reject) => {

    const blob = new Blob([javascript], {type: `application/javascript`});
    const blobURL = URL.createObjectURL(blob);
    worker = new Worker(blobURL, { type: "module" });

    worker.onmessage = (event) => {
      console.log("msg from worker:", event);
      resolve(worker);
    };
    worker.onerror = (err) => reject(err);
    worker.onmessageerror = (err) => reject(err);

    const wasmBuffer = Buffer.from(wasm, "base64");

    worker.postMessage(wasmBuffer, [wasmBuffer]);
  });
}

export async function executeOwnable(ownable_id, msg) {
  worker.addEventListener('message', async event => {
    const state = JSON.parse(event.data.get('state'));
    const mem = JSON.parse(event.data.get('mem'));
    self.postMessage({state, mem})
  }, { once: true });

  worker.postMessage(msg);
}

export function queryState(ownable_id, msg, state_dump) {
  return new Promise((resolve, reject) => {
    worker.addEventListener('message', async event => {
      console.log("contract queried: ", event);
      const stateMap = (event.data.get('state'));
      const decodedState = atob(JSON.parse(stateMap));
      const state = JSON.parse(decodedState);
      updateState(ownable_id, state);
      self.postMessage(state);
      resolve();
    }, { once: true });

    const workerMsg = {
      type: "query",
      ownable_id: ownable_id,
      msg: msg,
      idb: state_dump,
    };

    worker.postMessage(workerMsg);
  });

}

export function queryMetadata(ownable_id, msg, state_dump) {
  return new Promise(async (resolve, reject) => {

    worker.addEventListener('message', async event => {
      console.log("contract queried: ", event);
      const metadataMap = (event.data.get('state'));
      const decodedMetadata = atob(JSON.parse(metadataMap));
      const metadata = JSON.parse(decodedMetadata);
      self.postMessage(metadata);
      resolve();
    }, { once: true });

    const workerMsg = {
      type: "query",
      ownable_id: ownable_id,
      msg: msg,
      idb: state_dump,
    };

    worker.postMessage(workerMsg);
  })
}

export async function issueOwnable(ownable_id, msg, messageInfo) {
  return new Promise(async (resolve, reject) => {

    worker.addEventListener('message', async event => {
      self.postMessage(event.data);
      resolve();
    }, { once: true });

    const workerMsg = {
      type: "instantiate",
      ownable_id: ownable_id,
      msg: msg,
      info: messageInfo,
    };
    worker.postMessage(workerMsg);
  });
}

export async function transferOwnable(ownable_id, chainMessage, messageInfo, state_dump) {

    let workerMessage = {
      type: "execute",
      msg: chainMessage,
      info: messageInfo,
      ownable_id: ownable_id,
      idb: state_dump,
    }

    worker.onmessage = async (msg) => {
      self.postMessage(msg);
    };
    worker.postMessage(workerMessage);
}
