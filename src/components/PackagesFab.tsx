import { Fab, } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { TypedPackage, TypedPackageStub } from "../interfaces/TypedPackage";
import selectFile from "../utils/selectFile";
import Loading from "./Loading";
import { enqueueSnackbar } from "notistack";
import { usePackageManager } from "../hooks/usePackageManager";
import { PackagesDialog } from "./PackagesDialog"

interface PackagesFabProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (pkg: TypedPackage) => void;
  onImportFR: (pkg: TypedPackage[], triggerRefresh: boolean) => void;
  onError: (title: string, message: string) => void;
  onCreate: () => void;
  message: number;
}

export default function PackagesFab(props: PackagesFabProps) {
  const fabStyle = {
    position: "fixed",
    bgcolor: "common.white",
    bottom: 20,
    right: 20,
  };

  const { open, onOpen, onClose, onSelect, onImportFR, onError, message } = props;
  const { packages, isLoading, importPackages, importInbox, downloadExample } =
    usePackageManager();

  const importAll = async () => {
    const files = await selectFile({ accept: ".zip", multiple: true });

    try {
      await importPackages(files);
      enqueueSnackbar("Packages imported successfully", { variant: "success" });
    } catch (error) {
      onError(
        "Failed to import package",
        (error as Error).message || String(error)
      );
    }
  };

  const importPackagesFromRelay = async () => {
    try {
      const result = await importInbox();
      if (result == null) return;

      const [filteredPackages, triggerRefresh] = result as [
        Array<TypedPackage | undefined>,
        boolean
      ];

      const validPackages = Array.isArray(filteredPackages)
        ? filteredPackages.filter(
            (p): p is TypedPackage => p !== null && p !== undefined
          )
        : [];

      onImportFR(validPackages, triggerRefresh);
      enqueueSnackbar("Packages imported from relay", { variant: "success" });
    } catch (error) {
      onError(
        "Failed to import ownable",
        (error as Error).message || String(error)
      );
    }
  };

  const selectPackage = async (pkg: TypedPackage | TypedPackageStub) => {
    if ("stub" in pkg) {
      try {
        const downloadedPkg = await downloadExample(pkg.name);
        onSelect(downloadedPkg);
        enqueueSnackbar("Example package downloaded", { variant: "success" });
      } catch (error) {
        onError(
          "Failed to import package",
          (error as Error).message || String(error)
        );
        return;
      }
    } else {
      onSelect(pkg);
    }
  };

  return (
    <>
      <Fab sx={fabStyle} aria-label="add" size="large" onClick={onOpen}>
        <AddIcon fontSize="large" />
      </Fab>

      <PackagesDialog
        packages={packages}
        open={open}
        onClose={onClose}
        onSelect={selectPackage}
        onImport={importAll}
        fetchPkgFromRelay={importPackagesFromRelay}
        onCreate={props.onCreate}
        message={message}
        isLoading={isLoading}
      />
      <Loading show={isLoading} />
    </>
  );
}
