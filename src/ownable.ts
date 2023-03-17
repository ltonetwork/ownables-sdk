// This code runs inside the Ownable iframe. It's not part of the React app.
// See `ownable-js.webpack.js`

// @ts-ignore
import Listener from "simple-iframe-rpc/listener";

type Dict = {[prop: string]: any}
type StateDump = Array<[ArrayLike<number>, ArrayLike<number>]>

interface MsgInfo {
  sender: string;
  funds: Array<never>;
}

interface Response {
  attributes: Array<{key: string, value: any}>;
  events?: Array<{ty: string, attributes: Array<{key: string, value: any}>}>;
  data?: string;
}

const listener = new Listener({
  init,
  instantiate,
  execute,
  externalEvent,
  query,
  queryRaw,
  refresh,
});
listener.listen(window, "*");

let ownableId: string;
let worker: Worker;

window.addEventListener("message", (e) => {
  if (e.origin !== "null" || '@rpc' in e.data) return;
  window.parent.postMessage(e.data, "*");
});

function attributesToDict(attributes: Array<{key: string, value: any}>): Dict {
  return Object.fromEntries(attributes.map(a => [a.key, a.value]));
}

function init(id: string, javascript: string, wasm: Uint8Array): Promise<any> {
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

function workerCall<T extends Response|string>(
  type: string,
  ownableId: string,
  msg: Dict,
  info: Dict,
  state?: StateDump,
): Promise<{response: T, state: StateDump}> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(`Unable to ${type}: not initialized`);
      return;
    }

    worker.addEventListener('message', (event: MessageEvent<Map<string, any>|{err: any}>) => {
      if ('err' in event.data) {
        reject(new Error(`Ownable ${type} failed`, { cause: event.data.err }));
        return;
      }

      const response = JSON.parse(event.data.get('result'));
      const nextState: StateDump = event.data.has('mem') ? JSON.parse(event.data.get('mem')).state_dump : state;

      resolve({response, state: nextState});
    }, { once: true });

    worker.postMessage({type, ownable_id: ownableId, msg, info, mem: {state_dump: state}});
  });
}

async function instantiate(msg: Dict, info: Dict): Promise<{attributes: Dict, state: StateDump}> {
  const {response, state} = await workerCall<Response>(
    "instantiate",
    ownableId,
    msg,
    info
  );

  return {attributes: attributesToDict(response.attributes), state};
}

async function execute(
  msg: Dict,
  info: MsgInfo,
  state: StateDump
): Promise<{attributes: Dict, events: Array<{ty: string, attributes: Dict}>, data?: string, state: StateDump}> {
  const {response, state: newState} = await workerCall<Response>("execute", ownableId, msg, info, state);

  return {
    attributes: attributesToDict(response.attributes),
    events: response.events?.map(event => ({ty: event.ty, attributes: attributesToDict(event.attributes)})) || [],
    data: response.data,
    state: newState,
  };
}

async function externalEvent(
  msg: Dict,
  info: MsgInfo,
  state: StateDump
): Promise<{attributes: Dict, events: Array<{ty: string, attributes: Dict}>, data?: string, state: StateDump}> {
  const {response, state: newState} = await workerCall<Response>("external_event", ownableId, msg, info, state);

  return {
    attributes: attributesToDict(response.attributes),
    events: response.events?.map(event => ({ty: event.ty, attributes: attributesToDict(event.attributes)})) || [],
    data: response.data,
    state: newState,
  };
}

async function queryRaw(msg: Dict, state: StateDump): Promise<string> {
  return (await workerCall<string>("query", ownableId, msg, {}, state)).response;
}

async function query(msg: Dict, state: StateDump): Promise<Dict> {
  const resultB64 = await queryRaw(msg, state);
  return JSON.parse(atob(resultB64)) as Dict;
}

async function refresh(state: StateDump): Promise<void> {
  const widgetState = await query({get_ownable_config: {}}, state);

  const iframe = document.getElementsByTagName('iframe')[0];
  iframe.contentWindow!.postMessage({ownable_id: ownableId, state: widgetState}, "*");
}
