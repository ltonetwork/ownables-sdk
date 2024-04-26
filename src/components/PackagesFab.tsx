import * as React from "react";
import { Divider, Fab, ListItemIcon } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import Dialog from "@mui/material/Dialog";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { TypedPackage, TypedPackageStub } from "../interfaces/TypedPackage";
import If from "./If";
import selectFile from "../utils/selectFile";
import PackageService from "../services/Package.service";
import { useEffect } from "react";
import Tooltip from "./Tooltip";
import Loading from "./Loading";
import useBusy from "../utils/useBusy";

interface PackagesDialogProps {
  packages: Array<TypedPackage | TypedPackageStub>;
  open: boolean;
  onClose: () => void;
  onSelect: (pkg: TypedPackage | TypedPackageStub) => void;
  onImport: () => void;
  fetchPkgFromRelay: () => void;
}

function PackagesDialog(props: PackagesDialogProps) {
  const { onClose, onSelect, onImport, fetchPkgFromRelay, open, packages } =
    props;

  // useEffect(() => {
  //   fetchPkgFromRelay();
  // }, [fetchPkgFromRelay]);

  return (
    <Dialog onClose={onClose} open={open}>
      <List sx={{ pt: 0, minWidth: 250 }} disablePadding>
        {packages.map((pkg) => (
          <ListItem disablePadding disableGutters key={pkg.title}>
            <Tooltip
              condition={"stub" in pkg}
              title={`Import ${pkg.title} example`}
              placement="right"
              arrow
            >
              <ListItemButton
                onClick={() => onSelect(pkg)}
                style={{
                  textAlign: "center",
                  color: "stub" in pkg ? "#666" : undefined,
                }}
              >
                <ListItemText
                  primary={pkg.title}
                  secondary={pkg.description}
                  secondaryTypographyProps={{
                    color:
                      "stub" in pkg
                        ? "rgba(0, 0, 0, 0.3)"
                        : "rgba(0, 0, 0, 0.6)",
                    fontSize: "0.75em",
                  }}
                />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
      <If condition={packages.length > 0}>
        <Divider />
      </If>
      <List sx={{ pt: 0 }} disablePadding>
        <ListItem disablePadding disableGutters key="add">
          <ListItemButton
            autoFocus
            onClick={() => onImport()}
            style={{ textAlign: "center" }}
          >
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText primary="Import from local" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding disableGutters key="add">
          <ListItemButton
            autoFocus
            onClick={() => fetchPkgFromRelay()}
            style={{ textAlign: "center" }}
          >
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText primary="Import from relay" />
          </ListItemButton>
        </ListItem>
      </List>
    </Dialog>
  );
}

interface PackagesFabProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (pkg: TypedPackage) => void;
  onImportFR: (pkg: any) => void;
  onError: (title: string, message: string) => void;
}

export default function PackagesFab(props: PackagesFabProps) {
  const fabStyle = {
    position: "fixed",
    bgcolor: "common.white",
    bottom: 20,
    right: 20,
  };

  const { open, onOpen, onClose, onSelect, onImportFR, onError } = props;
  const [packages, setPackages] = React.useState<
    Array<TypedPackage | TypedPackageStub>
  >([]);
  const [isBusy, busy] = useBusy();

  const updatePackages = () => setPackages(PackageService.list());
  useEffect(updatePackages, []);

  const importPackages = async () => {
    const files = await selectFile({ accept: ".zip", multiple: true });
    if (files.length === 0) return;

    try {
      await busy(
        Promise.all(
          Array.from(files).map((file) => PackageService.import(file))
        )
      );
      updatePackages();
    } catch (error) {
      onError(
        "Failed to import package",
        (error as Error).message || (error as string)
      );
    }
  };

  const importPackagesFromRelay = async () => {
    try {
      const pkg = await PackageService.importFromRelay();
      onImportFR(pkg);
      //updatePackages();
    } catch (error) {
      onError(
        "Failed to import package",
        (error as Error).message || (error as string)
      );
    }
  };

  const selectPackage = async (pkg: TypedPackage | TypedPackageStub) => {
    if ("stub" in pkg) {
      try {
        pkg = await busy(PackageService.downloadExample(pkg.name));
        updatePackages();
      } catch (error) {
        onError(
          "Failed to import package",
          (error as Error).message || (error as string)
        );
        return;
      }
    }

    onSelect(pkg);
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
        onImport={importPackages}
        fetchPkgFromRelay={importPackagesFromRelay}
      />
      <Loading show={isBusy} />
    </>
  );
}
