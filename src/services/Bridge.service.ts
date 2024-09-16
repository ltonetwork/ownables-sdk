export class BridgeService {
  private static obuilderUrl =
    process.env.REACT_APP_OBUILDER || process.env.REACT_APP_LOCAL;

  //Template Cost
  static async getTemplateCost(templateId: string) {
    const url = `${this.obuilderUrl}/api/v1/templateCost?templateId=${templateId}`;
    const response = await fetch(url, {
      method: "GET",
    });
    if (response.status === 200) {
      const res = await response.json();
      return res;
    } else return null;
  }
  //send content to Bridge
  //
}
