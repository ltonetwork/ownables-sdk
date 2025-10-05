import { useState, useEffect, useCallback } from "react";
import { TypedPackage, TypedPackageStub } from "../interfaces/TypedPackage";
import { useService } from "./useService"

export const usePackageManager = () => {
  const [packages, setPackages] = useState<
    Array<TypedPackage | TypedPackageStub>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const packageService = useService('packages');

  const updatePackages = useCallback(() => {
    try {
      setPackages(packageService?.list() ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to update packages")
      );
    }
  }, [packageService]);

  useEffect(() => {
    updatePackages();
  }, [updatePackages]);

  const importPackage = async (file: File) => {
    if (!packageService) throw new Error("Package service not ready");

    setIsLoading(true);
    setError(null);
    try {
      const result = await packageService.import(file);
      updatePackages();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to import package");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const importInbox = async () => {
    if (!packageService) throw new Error("Package service not ready");

    setIsLoading(true);
    setError(null);
    try {
      const result = await packageService.importFromRelay();
      updatePackages();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to import from inbox");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const downloadExample = async (name: string) => {
    if (!packageService) throw new Error("Package service not ready");

    setIsLoading(true);
    setError(null);
    try {
      const result = await packageService.downloadExample(name);
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
