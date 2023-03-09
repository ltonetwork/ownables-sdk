import {Component, createRef, RefObject} from "react";
import TypedDict from "../interfaces/TypedDict";
import {Paper} from "@mui/material";
import OwnableFrame from "./OwnableFrame";
import {Cancelled, connect as rpcConnect} from "simple-iframe-rpc";
import PackageService from "../services/Package.service";
import {EventChain, Event} from "@ltonetwork/lto";

// @ts-ignore - Loaded as string, see `craco.config.js`
import workerJsSource from "../assets/worker.js";
import OwnableActions from "./OwnableActions";
import OwnableInfo from "./OwnableInfo";
import LTOService from "../services/LTO.service";
import OwnableService, {Mem} from "../services/Ownable.service";

interface MsgInfo {
  sender: string;
  funds: Array<never>;
}

interface OwnableRPC {
  init: (id: string, js: string, wasm: Uint8Array) => Promise<any>;
  instantiate: (msg: TypedDict<any>, info: MsgInfo) => Promise<{state: TypedDict<any>, mem: Mem}>;
  execute: (msg: TypedDict<any>, info: MsgInfo, mem: Mem) => Promise<{state: TypedDict<any>, mem: Mem}>;
  externalEvent: (msg: TypedDict<any>, info: MsgInfo, mem: Mem) => Promise<{state: TypedDict<any>, mem: Mem}>;
  query: (msg: TypedDict<any>, mem: Mem) => Promise<TypedDict<any>>;
  refresh: (mem: Mem) => Promise<void>;
}

interface OwnableProps {
  chain: EventChain;
  pkgKey: string;
}

interface OwnableState {
  rpc?: OwnableRPC;
  initialized: boolean;
  applied: EventChain;
  mem: Mem;
}

export default class Ownable extends Component<OwnableProps, OwnableState> {
  private readonly chain: EventChain;
  private readonly pkgKey: string;
  private readonly iframeRef: RefObject<HTMLIFrameElement>;
  private busy = false;

  constructor(props: OwnableProps) {
    super(props);

    this.chain = props.chain;
    this.pkgKey = props.pkgKey;
    this.iframeRef = createRef();

    this.state = {
      initialized: false,
      applied: new EventChain(this.chain.id),
      mem: [],
    };
  }

  get id(): string {
    return this.chain.id;
  }

  private async init(rpc: OwnableRPC): Promise<void> {
    const bindgenJs = await PackageService.getAssetAsText(this.pkgKey, 'bindgen.js');
    const js = workerJsSource + bindgenJs;

    const wasm = await PackageService.getAsset(
      this.pkgKey,
      'ownable_bg.wasm',
      (fr, file) => fr.readAsArrayBuffer(file)
    ) as ArrayBuffer;

    try {
      await rpc.init(this.id, js, new Uint8Array(wasm));
      this.setState({initialized: true});
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  private async apply(partialChain: EventChain): Promise<void> {
    if (this.busy || partialChain.events.length === 0) return;
    this.busy = true;

    const rpc = this.state.rpc!;
    let mem = this.state.mem;
    let response: {state: TypedDict<any>, mem: Mem};

    for (const event of partialChain.events) {
      response = await this.applyEvent(rpc, event, mem);
      mem = response.mem;
    }

    await rpc.refresh(mem); // Update widget to current state
    await OwnableService.store(this.chain, mem);

    this.setState({applied: this.chain, mem});
    this.busy = false;
  }

  async applyEvent(rpc: OwnableRPC, event: Event, mem: Mem) {
    const info = {
      sender: LTOService.account.publicKey,
      funds: [],
    }
    const {'@context': context, ...data} = event.parsedData;

    switch (context) {
      case "instantiate_msg.json":
        return await rpc.instantiate(data, info);
      case "execute_msg.json":
        return await rpc.execute(data, info, mem);
      case "external_event_msg.json":
        return await rpc.execute(data, info, mem);
      default:
        throw new Error(`Unknown event type`);
    }
  }

  async onLoad(): Promise<void> {
    if (this.state.rpc) {
      delete (this.state.rpc as any).handler; // In development mode, iframe might be replaced
      this.setState({initialized: false});
    }

    const iframeWindow = this.iframeRef.current!.contentWindow;
    const rpc = rpcConnect<Required<OwnableRPC>>(window, iframeWindow, "*", {timeout: 5000});
    this.setState({rpc});

    await this.init(rpc);
  }

  shouldComponentUpdate(next: OwnableProps, {initialized, applied}: OwnableState): boolean {
    return initialized && this.chain.latestHash.hex !== applied.latestHash.hex;
  }

  async componentDidUpdate(): Promise<void> {
    if (!this.state.initialized) return;
    await this.apply(this.chain.startingAfter(this.state.applied.latestHash));
  }

  componentWillUnmount() {
    if (this.state.rpc) {
      delete (this.state.rpc as any).handler;
    }
  }

  render() {
    return (
      <Paper sx={{aspectRatio: "1/1", position: 'relative'}}>
        <OwnableInfo sx={{position: 'absolute', left: 5, top: 5}}/>
        <OwnableActions sx={{position: 'absolute', right: 5, top: 5}}/>
        <OwnableFrame id={this.id} pkgKey={this.pkgKey} iframeRef={this.iframeRef} onLoad={() => this.onLoad()}/>
      </Paper>
    )
  }
}
