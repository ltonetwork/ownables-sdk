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
import OwnableService, {StateDump} from "../services/Ownable.service";

interface MsgInfo {
  sender: string;
  funds: Array<never>;
}

interface OwnableRPC {
  init: (id: string, js: string, wasm: Uint8Array) => Promise<any>;
  instantiate: (msg: TypedDict<any>, info: MsgInfo) => Promise<{result: TypedDict<any>, state: StateDump}>;
  execute: (msg: TypedDict<any>, info: MsgInfo, state: StateDump) => Promise<{result: TypedDict<any>, state: StateDump}>;
  externalEvent: (msg: TypedDict<any>, info: MsgInfo, state: StateDump) => Promise<{result: TypedDict<any>, state: StateDump}>;
  query: (msg: TypedDict<any>, state: StateDump) => Promise<TypedDict<any>>;
  refresh: (state: StateDump) => Promise<void>;
}

interface OwnableProps {
  chain: EventChain;
  pkgKey: string;
}

interface OwnableState {
  rpc?: OwnableRPC;
  initialized: boolean;
  applied: EventChain;
  stateDump: StateDump;
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
      stateDump: [],
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
      await OwnableService.init(this.chain, this.pkgKey);
      this.setState({initialized: true});
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  private async refresh(): Promise<void> {
    const rpc = this.state.rpc!;
    const stateDump = this.state.stateDump;

    await rpc.refresh(stateDump);
  }

  private async apply(partialChain: EventChain): Promise<void> {
    if (this.busy) return;
    this.busy = true;

    const rpc = this.state.rpc!;
    let stateDump = this.state.stateDump;
    let response: {result: TypedDict<any>, state: StateDump};

    for (const event of partialChain.events) {
      response = await this.applyEvent(rpc, event, stateDump);
      stateDump = response.state;
    }

    //await rpc.refresh(stateDump);
    await OwnableService.store(this.chain, stateDump);

    this.setState({applied: this.chain, stateDump: stateDump});
    this.busy = false;
  }

  async applyEvent(rpc: OwnableRPC, event: Event, stateDump: StateDump) {
    const info = {
      sender: LTOService.account.publicKey,
      funds: [],
    }
    const {'@context': context, ...data} = event.parsedData;

    switch (context) {
      case "instantiate_msg.json":
        return await rpc.instantiate(data, info);
      case "execute_msg.json":
        return await rpc.execute(data, info, stateDump);
      case "external_event_msg.json":
        return await rpc.execute(data, info, stateDump);
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

  async componentDidMount() {
    const stateDump = await OwnableService.getStateDump(this.chain.id, this.chain.state);
    if (stateDump !== null) {
      this.setState({applied: this.chain, stateDump});
    }
  }

  shouldComponentUpdate(next: OwnableProps, {initialized, applied}: OwnableState): boolean {
    return initialized && (!this.state.initialized || this.chain.latestHash.hex !== applied.latestHash.hex);
  }

  async componentDidUpdate(): Promise<void> {
    const partial = this.chain.startingAfter(this.state.applied.latestHash);

    if (partial.events.length > 0)
      await this.apply(partial);
    else
      await this.refresh();
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
