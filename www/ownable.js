let worker;

addEventListener('message', async (e) => {
  // only accept msgs from document source
  if (e.origin === "null") {
    window.parent.postMessage(e.data, "*");
    const iframe = document.getElementById(e.data.ownable_id);
    iframe.contentWindow.body.postMessage(e.data, "*");
    return;
  }

  let args = e.data.args;
  console.log(e);
  switch (e.data.method) {
    case "initWorker":
      await initWorker(args[0], args[1], args[2]);
      break;
    case "issueOwnable":
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
      console.error("unsupported rpc call", e.data);
      throw new Error(`Unsupported RPC function ${e.data.method}`)
      break;
  }
});

async function initWorker(ownableId, javascript, wasm) {
  return new Promise(async (resolve, reject) => {
    const blob = new Blob([javascript], {type: `application/javascript`});
    const blobURL = URL.createObjectURL(blob);
    worker = new Worker(blobURL, { type: "module" });

    worker.onmessage = (event) => {
      window.parent.postMessage(event.data, "*");
      resolve();
    };
    worker.onerror = (err) => reject(err);
    worker.onmessageerror = (err) => reject(err);

    const wasmBuffer = Array.from(atob(wasm), c => c.charCodeAt(0));
    const buffer = new Uint8Array(wasmBuffer).buffer;

    worker.postMessage(buffer, [buffer]);
  });
}

function updateState(ownable_id, state) {
  const iframe = document.getElementById(ownable_id);
  iframe.contentWindow.postMessage({ownable_id, state}, "*");
}

async function executeOwnable(ownable_id, msg) {
  worker.addEventListener('message', async event => {
    const state = JSON.parse(event.data.get('state'));
    const mem = JSON.parse(event.data.get('mem'));
    window.postMessage({state, mem})
  }, { once: true });

  worker.postMessage(msg);
}

function queryState(ownable_id, msg, state_dump) {
  return new Promise((resolve, reject) => {
    worker.addEventListener('message', async event => {
      const stateMap = (event.data.get('state'));
      const decodedState = atob(JSON.parse(stateMap));
      const state = JSON.parse(decodedState);
      updateState(ownable_id, state);
      window.postMessage(state);
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

function queryMetadata(ownable_id, msg, state_dump) {
  return new Promise(async (resolve, reject) => {

    worker.addEventListener('message', async event => {
      const metadataString = atob(JSON.parse(event.data.get('state')));
      const metadata = JSON.parse(metadataString);
      console.log("contract metadata: ", metadata);
      window.parent.postMessage(metadata);
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

async function issueOwnable(ownable_id, msg, messageInfo) {
  return new Promise(async (resolve, reject) => {
    worker.addEventListener('message', async event => {
      const stateMap = JSON.parse(event.data.get('state'));
      const state = Object.fromEntries(stateMap.attributes.map(a => [a.key, a.value]));

      updateState(ownable_id, state);
      window.parent.postMessage(event.data);
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

async function transferOwnable(ownable_id, chainMessage, messageInfo, state_dump) {
  let workerMessage = {
    type: "execute",
    msg: chainMessage,
    info: messageInfo,
    ownable_id: ownable_id,
    idb: state_dump,
  }

  worker.addEventListener('message', async event => {
    window.parent.postMessage(event.data, "*");
  }, { once: true });

  worker.postMessage(workerMessage);
}
