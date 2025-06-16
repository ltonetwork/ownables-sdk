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
import EventChainService from "../services/EventChain.service";
import { RelayService } from "../services/Relay.service";
import { enqueueSnackbar } from "notistack";
import { BridgeService } from "../services/Bridge.service";
import shortId from "../utils/shortId";
import SessionStorageService from "../services/SessionStorage.service";
//import LocalStorageService from "../services/LocalStorage.service";
import { RedeemService } from "../services/Redeem.service";
import { PACKAGE_TYPE } from "../constants";
import IDBService from "../services/IDB.service";
import { IMessageMeta } from "@ltonetwork/lto/interfaces";

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

  private async checkRedeemable(): Promise<boolean> {
    try {
      const genesisAddress = await RedeemService.getOwnableCreator(
        this.chain.events
      );

      this.chain.validate();

      const response = await RedeemService.isRedeemable(
        genesisAddress,
        this.pkg.title
      );
      return response.isRedeemable;
    } catch (error) {
      console.error("Error checking redeemable status:", error);
      return false;
    }
  }

  get isRedeemed(): boolean {
    const ownedBySwap =
      !!this.state.info && this.state.info.owner === this.state.redeemAddress;

    return (
      this.isTransferred && ownedBySwap && this.state.isRedeemable === true
    );
  }

  get isTransferred(): boolean {
    return (
      !!this.state.info &&
      this.state.info.owner !== LTOService.address &&
      this.state.info.owner !== undefined
    );
  }

  get isBridged() {
    const bridgeAddress = SessionStorageService.get("bridgeAddress");
    const currentOwner = this.state.info?.owner;
    if (!bridgeAddress || !currentOwner) return false;
    return currentOwner === bridgeAddress;
  }

  get hasNFT(): boolean {
    return this.pkg.keywords?.includes("hasNFT") ?? false;
  }

  get nftNetwork(): string {
    const nftNetwork = this.state.info?.nft?.network;
    return nftNetwork || "";
  }

  private async redeem(): Promise<void> {
    try {
      const redeemAddress = await RedeemService.redeemAddress();
      const genesisAddress = await RedeemService.getOwnableCreator(
        this.chain.events
      );
      const response = await RedeemService.isRedeemable(
        genesisAddress,
        this.pkg.title
      );

      await this.execute({ transfer: { to: redeemAddress } });

      const zip = await OwnableService.zip(this.chain);
      const content = await zip.generateAsync({
        type: "uint8array",
      });

      //construct Metadata
      const meta = await this.constructMeta();

      await RelayService.sendOwnable(redeemAddress, content, meta);
      enqueueSnackbar("Successfully redeemed!", { variant: "success" });

      const account = LTOService.getAccount();
      const address = (await account).address;

      await RedeemService.storeDetail(address, response.value, this.chain.id);

      if (this.pkg.uniqueMessageHash) {
        await RelayService.removeOwnable(this.pkg.uniqueMessageHash);
      }
    } catch (error) {
      console.error("Error during redeem:", error);
      enqueueSnackbar("Failed to redeem. Try again.", { variant: "error" });
    }
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

  private async bridge(
    address: string,
    fee: number | null,
    nftNetwork?: string
  ): Promise<void> {
    try {
      const bridgeAddress = await BridgeService.getBridgeAddress();

      //   const previousHash: string = this.chain.latestHash.hex;

      await this.execute({ transfer: { to: bridgeAddress } });

      this.chain.validate();

      const zip = await OwnableService.zip(this.chain);
      const content = await zip.generateAsync({
        type: "uint8array",
      });
      const filename = `ownable.${shortId(this.chain.id, 12, "")}.${shortId(
        this.chain.state?.base58,
        8,
        ""
      )}.zip`;
      const transactionId = await BridgeService.payBridgingFee(
        fee,
        bridgeAddress
      );
      const contentBlob = new Blob([content], {
        type: "application/octet-stream",
      });
      if (transactionId) {
        await BridgeService.bridgeOwnableToNft(
          address,
          transactionId,
          filename,
          contentBlob
        );
      }
      //remove ownable from relay's inbox
      if (this.pkg.uniqueMessageHash) {
        await RelayService.removeOwnable(this.pkg.uniqueMessageHash);
      }
      const hashes = JSON.parse(localStorage.getItem("messageHashes") || "[]");

      const updatedHashes = hashes.filter(
        (item: any) => item.uniqueMessageHash !== this.pkg.uniqueMessageHash
      );

      localStorage.setItem("messageHashes", JSON.stringify(updatedHashes));
      enqueueSnackbar("Successfully bridged!!", { variant: "success" });
    } catch (error) {
      console.error("Error while attempting to bridge:", error);
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
      const stateDump = await OwnableService.apply(
        partialChain,
        this.state.stateDump
      );
      await this.refresh(stateDump);
      this.setState({ applied: partialChain.latestHash });
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

    let bridgeAddress = SessionStorageService.get("bridgeAddress");

    if (!bridgeAddress) {
      bridgeAddress = await BridgeService.getBridgeAddress();
      if (bridgeAddress) {
        SessionStorageService.set("bridgeAddress", bridgeAddress);
      }
    }

    try {
      const [isRedeemable, redeemAddress] = await Promise.all([
        this.checkRedeemable(),
        RedeemService.redeemAddress(),
      ]);
      this.setState({ isRedeemable, redeemAddress });
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
    const partial = this.chain.startingAfter(this.state.applied);
    if (partial.events.length > 0) await this.apply(partial);
    else if (
      this.state.initialized !== prev.initialized ||
      this.state.applied.hex !== prev.applied.hex
    )
      await this.refresh();
  }

  componentWillUnmount() {
    OwnableService.clearRpc(this.chain.id);
    window.removeEventListener("message", this.windowMessageHandler);
  }

  render() {
    const { selected, children } = this.props;
    const { initialized, info, metadata, isRedeemable, isApplying } =
      this.state;

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
          isBridgeable={!this.isTransferred && this.hasNFT}
          isRedeemable={this.state.isRedeemable}
          nftNetwork={this.nftNetwork}
          onDelete={this.props.onDelete}
          chain={this.chain}
          onConsume={() =>
            !!this.state.info && this.props.onConsume(this.state.info)
          }
          onTransfer={(address) => this.transfer(address)}
          onBridge={(address, fee) => {
            if (!fee) return;
            this.bridge(address, fee, this.nftNetwork);
          }}
          onRedeem={(value: number | null) => {
            if (value !== null) {
              this.redeem();
            }
          }}
        />
        {children}
        <If condition={isApplying}>
          <Overlay>
            <OverlayBanner>Applying state...</OverlayBanner>
          </Overlay>
        </If>
        <If condition={this.isTransferred && !this.isBridged}>
          <Tooltip
            title="You're unable to interact with this Ownable, because it has been transferred to a different account."
            followCursor
          >
            <Overlay sx={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}>
              <OverlayBanner>Transferred</OverlayBanner>
            </Overlay>
          </Tooltip>
        </If>
        <If condition={this.isRedeemed}>
          <Tooltip
            title="You're unable to interact with this Ownable, because it has been sent to the redeemed."
            followCursor
          >
            <Overlay sx={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}>
              <OverlayBanner>Reedemed</OverlayBanner>
            </Overlay>
          </Tooltip>
        </If>
        <If condition={this.isBridged && this.isTransferred}>
          <Tooltip
            title="You're unable to interact with this Ownable, because it has been sent to the bridge."
            followCursor
          >
            <Overlay sx={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}>
              <OverlayBanner>Bridged</OverlayBanner>
            </Overlay>
          </Tooltip>
        </If>
      </Paper>
    );
  }
}
