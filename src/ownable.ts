// This code runs inside the Ownable iframe. It's not part of the React app.
// See `ownable-js.webpack.js`

import Listener from "simple-iframe-rpc/lib/listener";

type Entries<T> = Array<[T, T]>;
type Dict = {[prop: string]: any};

const listener = new Listener({
  init,
  instantiate,
  execute,
  externalEvent,
  query,
  refresh,
});
listener.listen(window, "null");

let ownableId: string;
let worker: Worker;

function init(id: string, javascript: string, wasm: Uint8Array) {
  ownableId = id;

  return new Promise(async (resolve, reject) => {
    const blob = new Blob([javascript], {type: `application/javascript`});
    const blobURL = URL.createObjectURL(blob);
    worker = new Worker(blobURL, { type: "module" });

    worker.onmessage = (event) => {
      resolve(event.data);
    };
    worker.onerror = (err) => reject(err);
    worker.onmessageerror = (err) => reject(err);

    const buffer = wasm.buffer;
    worker.postMessage(buffer, [buffer]);
  });
}

function workerCall<T extends string|Dict>(
  type: string,
  ownableId: string,
  msg: Dict,
  info: Dict,
  idb?: Entries<ArrayLike<number>>,
): Promise<{state: T, mem: Entries<number[]>}> {
  if (!worker) throw new Error("Unable to execute: not initialized");

  return new Promise((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<Map<string, any>|{err: any}>) => {
      if ('err' in event.data) {
        reject(event.data.err);
        return;
      }

      const state = JSON.parse(event.data.get('state'));
      const mem = JSON.parse(event.data.get('mem'));
      resolve({state, mem});
    }, { once: true });

    worker.postMessage({type, ownable_id: ownableId, msg, info, idb});
  });
}

async function instantiate(msg: Dict, info: Dict) {
  const {state: stateMap, mem} = await workerCall<{attributes: [{key: string, value: any}]}>(
    "instantiate",
    ownableId,
    msg,
    info
  );

  const state = Object.fromEntries(stateMap.attributes.map(a => [a.key, a.value]));
  return {state, mem};
}

function execute(ownableId: string, msg: Dict, idb: Entries<ArrayLike<number>>): Promise<{state: Dict, mem: Entries<number[]>}> {
  return workerCall<Dict>("execute", ownableId, msg, {}, idb);
}

function externalEvent(ownableId: string, msg: Dict, idb: Entries<ArrayLike<number>>): Promise<{state: Dict, mem: Entries<number[]>}> {
  return workerCall<Dict>("external_event", ownableId, msg, {}, idb);
}

async function refresh(idb: Entries<ArrayLike<number>>): Promise<void> {
  const {state: stateB64} = await workerCall<string>("query", ownableId, {getWidgetState: {}}, {}, idb);
  const state = JSON.parse(atob(stateB64)) as Dict;

  const iframe = document.getElementsByTagName('iframe')[0];
  iframe.contentWindow!.postMessage({ownableId, state}, "*");
}

async function query(msg: Dict, idb: Entries<ArrayLike<number>>): Promise<Dict> {
  const {state: stateB64} = await workerCall<string>("query", ownableId, {getWidgetState: {}}, {}, idb);
  return JSON.parse(atob(stateB64)) as Dict;
}
