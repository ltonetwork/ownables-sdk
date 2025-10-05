import axios from "axios"

export default class BuilderService {
  public static URL: string = process.env.REACT_APP_OBUILDER ?? '';
  public static SECRET?: string = process.env.REACT_APP_OBUILDER_API_SECRET_KEY;

  constructor(private chainId: number) {}

  public async getAddress() {
    if (!BuilderService.URL) {
      return null;
    }

    try {
      const response = await axios.get(
        `${BuilderService.URL}/api/v1/GetServerInfo?chainId=${this.chainId}`,
        {
          headers: {
            "X-API-Key": `${BuilderService.SECRET}`,
            Accept: "*/*",
          },
        }
      );

      return response.data.serverWalletAddress;
    } catch (error) {
      console.error("Failed to fetch builder address:", error);
      return null;
    }
  };
}
