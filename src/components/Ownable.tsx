import {createRef, useEffect, useRef, useState} from "react";
import TypedDict from "../interfaces/TypedDict";
import {Paper} from "@mui/material";
import OwnableFrame from "./OwnableFrame";
import {connect as rpcConnect} from "simple-iframe-rpc";
import PackageService from "../services/Package.service";
import {EventChain} from "@ltonetwork/lto";

// @ts-ignore - Loaded as string, see `craco.config.js`
import workerJsSource from "../assets/worker.js";

interface OwnableRPC {
  init: (js: string, wasm: Uint8Array) => Promise<void>;
  instantiate: (msg: TypedDict<any>) => Promise<{state: TypedDict<any>, mem: Array<[number, number]>}>;
  execute: (msg: TypedDict<any>, mem: Array<[Uint8Array, Uint8Array]>) =>
    Promise<{state: TypedDict<any>, mem: Array<[number, number]>}>;
  externalEvent: (msg: TypedDict<any>, mem: Array<[Uint8Array, Uint8Array]>) =>
    Promise<{state: TypedDict<any>, mem: Array<[number, number]>}>;
  query: (msg: TypedDict<any>, mem: Array<[Uint8Array, Uint8Array]>) => Promise<TypedDict<any>>;
  refresh: (msg: TypedDict<any>, mem: Array<[Uint8Array, Uint8Array]>) => Promise<void>;
}

interface OwnableProps {
  chain: EventChain;
  pkgKey: string;
}

async function init(rpc: OwnableRPC, pkgKey: string): Promise<void> {
  const bindgenJs = await PackageService.getAssetAsText(pkgKey, 'bindgen.js');
  const js = workerJsSource + bindgenJs;

  const wasm = await PackageService.getAsset(
    pkgKey,
    'ownable_bg.wasm',
    (fr, file) => fr.readAsArrayBuffer(file)
  ) as ArrayBuffer;

  await rpc.init(js, new Uint8Array(wasm));
}

export default function Ownable(props: OwnableProps) {
  const {chain, pkgKey} = props;
  const applied = useRef<EventChain>();
  const [rpc, setRpc] = useState<OwnableRPC>();
  const iframeRef = createRef<HTMLIFrameElement>();

  useEffect(() => {
    if (!iframeRef.current) return;

    const rpc = rpcConnect<Required<OwnableRPC>>(window, iframeRef.current.contentWindow, "*");
    init(rpc, pkgKey).then(() => setRpc(rpc));
  }, [iframeRef, pkgKey]);

  useEffect(() => {
    if (!rpc) return;

    const partialChain = applied.current ? chain.startingWith(applied.current.latestHash) : chain;
    console.log("Apply events", ...partialChain.events);

    applied.current = chain;
  }, [rpc, chain]);

  return <Paper style={{aspectRatio: "1/1"}}>
    <OwnableFrame id={chain.id} pkgKey={pkgKey} iframeRef={iframeRef} />
  </Paper>
}
