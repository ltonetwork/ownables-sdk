import LTOService from "./LTO.service";
import calculateCid from "../utils/calculateCid";

export default class ProcessRelayEvents {
  static async eventChain(files: any) {
    let chain: any;
    const handleEvents = files
      .filter((file: any) => file.name === "chain.json")
      .map(async (chainFile: any) => {
        const chainJsonContent = await chainFile.async("text");
        chain = JSON.parse(chainJsonContent);
        chain.networkId = LTOService.networkId;

        const pkg: any = await files.filter(
          (file: any) => file.name === "instantiate_msg.json"
        );

        const msg = {
          "@context": "instantiate_msg.json",
          ownable_id: chain.id,
          package: calculateCid(pkg),
          network_id: LTOService.networkId,
        };
        chain.events.parsedData = msg;
      });

    return handleEvents;
  }
}
