import LocalStorageService from "./LocalStorage.service";
import {TypedPackage} from "../interfaces/TypedPackage";

export default class PackageService {
  static list(): TypedPackage[] {
    return LocalStorageService.get('packages') || [];
  }

  static add(file: File): TypedPackage {
    const randomName = (Math.random() + 1).toString(36).substring(6);
    return { name: randomName };
  }
}
