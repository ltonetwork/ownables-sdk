import { Component, createRef, ReactNode, RefObject } from "react";
import { Paper, Tooltip } from "@mui/material";
import OwnableFrame from "./OwnableFrame";
import { Cancelled, connect as rpcConnect } from "simple-iframe-rpc";
import PackageService from "../services/Package.service";
import { Binary, EventChain } from "@ltonetwork/lto";
import OwnableActions from "./OwnableActions";
import OwnableInfo from "./OwnableInfo";
import OwnableService, {
  OwnableRPC,
  StateDump,
} from "../services/Ownable.service";
import {
  TypedMetadata,
  TypedOwnableInfo,
} from "../interfaces/TypedOwnableInfo";
import isObject from "../utils/isObject";
import ownableErrorMessage from "../utils/ownableErrorMessage";
import TypedDict from "../interfaces/TypedDict";
import { TypedPackage } from "../interfaces/TypedPackage";
import Overlay, { OverlayBanner } from "./Overlay";
import LTOService from "../services/LTO.service";
import If from "./If";
import { RelayService } from "../services/Relay.service";
import { enqueueSnackbar } from "notistack";
//import LocalStorageService from "../services/LocalStorage.service";
import { PACKAGE_TYPE } from "../constants";
import IDBService from "../services/IDB.service";
import { IMessageMeta } from "@ltonetwork/lto/interfaces";
import EventChainService from "../services/EventChain.service";

interface OwnableProps {
  chain: EventChain;
  packageCid: string;
  selected: boolean;
  uniqueMessageHash?: string;
  onDelete: () => void;
  onConsume: (info: TypedOwnableInfo) => void;
  onRemove: () => void;
  onError: (title: string, message: string) => void;
  children?: ReactNode;
}

interface OwnableState {
  initialized: boolean;
  applied: Binary;
  stateDump: StateDump;
  info?: TypedOwnableInfo;
  metadata: TypedMetadata;
  isRedeemable: boolean;
  redeemAddress?: string;
  isApplying: boolean;
  error?: string;
}

export default class Ownable extends Component<OwnableProps, OwnableState> {
  private readonly pkg: TypedPackage;
  private readonly iframeRef: RefObject<HTMLIFrameElement>;
  private busy = false;

  constructor(props: OwnableProps) {
    super(props);
    this.pkg = PackageService.info(props.packageCid, props?.uniqueMessageHash);
    this.iframeRef = createRef();
    this.state = {
      initialized: false,
      applied: new EventChain(this.chain.id).latestHash,
      stateDump: [],
      metadata: { name: this.pkg.title, description: this.pkg.description },
      isRedeemable: false,
      isApplying: false,
    };
  }

  get chain(): EventChain {
    return this.props.chain;
  }

  get isTransferred(): boolean {
    return (
      !!this.state.info &&
      this.state.info.owner !== LTOService.address &&
      this.state.info.owner !== undefined
    );
  }

  get hasNFT(): boolean {
    return this.pkg.keywords?.includes("hasNFT") ?? false;
  }

  get nftNetwork(): string {
    const nftNetwork = this.state.info?.nft?.network;
    return nftNetwork || "";
  }

  private async resizeToThumbnail(file: File): Promise<Blob> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });

    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.drawImage(img, 0, 0, 50, 50);

    const quality = 0.8; // adjustment
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );

    if (!blob) {
      throw new Error("Failed to create thumbnail blob");
    }

    if (blob.size > 256 * 1024) {
      throw new Error("Compressed thumbnail still exceeds 256KB");
    }

    return blob;
  }

  private async constructMeta(): Promise<Partial<IMessageMeta>> {
    const title = this.pkg.title;
    const description = this.pkg.description ?? "";
    const type = PACKAGE_TYPE;

    let thumbnail: Binary | undefined;

    const thumbnailFile = await IDBService.get(
      `package:${this.pkg.cid}`,
      "thumbnail.webp"
    );

    if (thumbnailFile) {
      const resizedFile = await this.resizeToThumbnail(thumbnailFile);
      const buffer = await resizedFile.arrayBuffer();
      thumbnail = Binary.from(new Uint8Array(buffer));
    }

    return {
      type,
      title,
      description,
      thumbnail,
    };
  }

  private async transfer(to: string): Promise<void> {
    try {
      const value = await RelayService.isRelayUp();

      if (value) {
        await this.execute({ transfer: { to: to } });
        const zip = await OwnableService.zip(this.chain);
        const content = await zip.generateAsync({
          type: "uint8array",
        });

        //construct Metadata
        const meta = await this.constructMeta();

        await RelayService.sendOwnable(to, content, meta);
        enqueueSnackbar(`Ownable sent Successfully!!`, {
          variant: "success",
        });

        if (this.pkg.uniqueMessageHash) {
          //remove from relay
          await RelayService.removeOwnable(this.pkg.uniqueMessageHash);

          //remove from IDB
          await OwnableService.delete(this.chain.id);

          //remove from LS
          // await LocalStorageService.removeByField(
          //   "packages",
          //   "uniqueMessageHash",
          //   this.pkg.uniqueMessageHash
          // );
        }
      } else {
        enqueueSnackbar("Server is down", { variant: "error" });
      }

      // const filename = `ownable.${shortId(this.chain.id, 12, "")}.${shortId(
      //   this.chain.state?.base58,
      //   8,
      //   ""
      // )}.zip`;
      // asDownload(content, filename);
    } catch (error) {
      console.error("Error during transfer:", error);
    }
  }

  private async refresh(stateDump?: StateDump): Promise<void> {
    if (!stateDump) stateDump = this.state.stateDump;

    if (this.pkg.hasWidgetState)
      await OwnableService.rpc(this.chain.id).refresh(stateDump);

    const info = (await OwnableService.rpc(this.chain.id).query(
      { get_info: {} },
      stateDump
    )) as TypedOwnableInfo;
    const metadata = this.pkg.hasMetadata
      ? ((await OwnableService.rpc(this.chain.id).query(
          { get_metadata: {} },
          stateDump
        )) as TypedMetadata)
      : this.state.metadata;

    this.setState({ info, metadata });
  }

  private async apply(partialChain: EventChain): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.setState({ isApplying: true });

    try {
      const stateDump =
        (await EventChainService.getStateDump(
          this.chain.id,
          partialChain.state
        )) || // Use stored state dump if available
        (await OwnableService.apply(partialChain, this.state.stateDump));

      await this.refresh(stateDump);
      this.setState({ applied: this.chain.latestHash, stateDump });
    } catch (error) {
      console.error("Error applying chain:", error);
      this.props.onError(
        "Failed to apply chain",
        ownableErrorMessage(error as Error)
      );
    } finally {
      this.busy = false;
      this.setState({ isApplying: false });
    }
  }

  async onLoad(): Promise<void> {
    if (!this.pkg.isDynamic) {
      await OwnableService.initStore(
        this.chain,
        this.pkg.cid,
        this.pkg.uniqueMessageHash
      );
      return;
    }

    const iframeWindow = this.iframeRef.current!.contentWindow;
    const rpc = rpcConnect<Required<OwnableRPC>>(window, iframeWindow, "*", {
      timeout: 5000,
    });

    try {
      await OwnableService.init(
        this.chain,
        this.pkg.cid,
        rpc,
        this.props.uniqueMessageHash
      );
      this.setState({ initialized: true });
    } catch (e) {
      if (e instanceof Cancelled) return;
      this.props.onError("Failed to forge Ownable", ownableErrorMessage(e));
    }
  }

  private async execute(msg: TypedDict): Promise<void> {
    let stateDump: StateDump;

    try {
      stateDump = await OwnableService.execute(
        this.chain,
        msg,
        this.state.stateDump
      );

      await OwnableService.store(this.chain, stateDump);
      await this.refresh(stateDump);
      this.setState({ applied: this.chain.latestHash, stateDump });
    } catch (error) {
      this.props.onError(
        "The Ownable returned an error",
        ownableErrorMessage(error)
      );
      return;
    }
  }

  private windowMessageHandler = async (event: MessageEvent) => {
    if (
      !isObject(event.data) ||
      !("ownable_id" in event.data) ||
      event.data.ownable_id !== this.chain.id
    )
      return;
    if (this.iframeRef.current!.contentWindow !== event.source)
      throw Error("Not allowed to execute msg on other Ownable");

    await this.execute(event.data.msg);
  };

  async componentDidMount() {
    window.addEventListener("message", this.windowMessageHandler);

    try {
    } catch (error) {
      console.error("Error during initialization:", error);
    }
  }

  shouldComponentUpdate(
    nextProps: OwnableProps,
    nextState: OwnableState
  ): boolean {
    return nextState.initialized;
  }

  async componentDidUpdate(_: OwnableProps, prev: OwnableState): Promise<void> {
    // Don't try to apply if we're already applying or if there was an error
    if (this.state.isApplying || this.state.error) return;

    const partial = this.chain.startingAfter(this.state.applied);
    if (partial.events.length > 0) {
      try {
        await this.apply(partial);
      } catch (error) {
        console.error("Error applying chain:", error);
        this.setState({ error: ownableErrorMessage(error as Error) });
      }
    } else if (
      this.state.initialized !== prev.initialized ||
      this.state.applied.hex !== prev.applied.hex
    ) {
      await this.refresh();
    }
  }

  componentWillUnmount() {
    OwnableService.clearRpc(this.chain.id);
    window.removeEventListener("message", this.windowMessageHandler);
  }

  render() {
    const { selected, children } = this.props;
    const { isApplying } = this.state;

    return (
      <Paper
        elevation={selected ? 8 : 1}
        sx={{
          aspectRatio: "1/1",
          position: "relative",
          animation: selected ? "bounce .4s ease infinite alternate" : "",
        }}
      >
        <OwnableFrame
          id={this.chain.id}
          packageCid={this.pkg.cid}
          isDynamic={this.pkg.isDynamic}
          iframeRef={this.iframeRef}
          onLoad={() => this.onLoad()}
        />
        <OwnableInfo
          sx={{ position: "absolute", left: 5, top: 5, zIndex: 10 }}
          chain={this.chain}
          metadata={this.state.metadata}
        />
        <OwnableActions
          sx={{ position: "absolute", right: 5, top: 5, zIndex: 10 }}
          title={this.pkg.title}
          isConsumable={this.pkg.isConsumable && !this.isTransferred}
          isTransferable={this.pkg.isTransferable && !this.isTransferred}
          onDelete={this.props.onDelete}
          chain={this.chain}
          onConsume={() =>
            !!this.state.info && this.props.onConsume(this.state.info)
          }
          onTransfer={(address) => this.transfer(address)}
        />
        {children}
        <If condition={isApplying}>
          <Overlay>
            <OverlayBanner>Applying state...</OverlayBanner>
          </Overlay>
        </If>
        <If condition={this.isTransferred}>
          <Tooltip
            title="You're unable to interact with this Ownable, because it has been transferred to a different account."
            followCursor
          >
            <Overlay sx={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}>
              <OverlayBanner>Transferred</OverlayBanner>
            </Overlay>
          </Tooltip>
        </If>
      </Paper>
    );
  }
}
