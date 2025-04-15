import { useState, useEffect } from "react";
import PackageService from "../services/Package.service";
import { TypedPackage, TypedPackageStub } from "../interfaces/TypedPackage";

export const usePackageManager = () => {
  const [packages, setPackages] = useState<
    Array<TypedPackage | TypedPackageStub>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updatePackages = () => {
    try {
      setPackages(PackageService.list());
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to update packages")
      );
    }
  };

  useEffect(() => {
    updatePackages();
  }, []);

  const importPackage = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await PackageService.import(file);
      updatePackages();
      return result;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to import package");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const importInbox = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await PackageService.importFromRelay();
      updatePackages();
      return result;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to import from inbox");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const downloadExample = async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await PackageService.downloadExample(name);
      updatePackages();
      return result;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to download example");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    packages,
    isLoading,
    error,
    updatePackages,
    importPackage,
    importInbox,
    downloadExample,
  };
};
