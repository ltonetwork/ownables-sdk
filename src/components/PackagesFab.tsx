import React, { useState, useEffect } from "react";
import { Divider, Fab, ListItemIcon, Badge } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MailIcon from "@mui/icons-material/MailOutlined";
import Dialog from "@mui/material/Dialog";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { TypedPackage, TypedPackageStub } from "../interfaces/TypedPackage";
import If from "./If";
import selectFile from "../utils/selectFile";
import PackageService from "../services/Package.service";
import Tooltip from "./Tooltip";
import Loading from "./Loading";
import useBusy from "../utils/useBusy";
import { checkForMessages } from "../services/CheckMessages.service";

//globally pass the messages in the relay
export let newMessage: number | null;

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
  const filteredPackages = packages.filter((pkg) => !pkg.isNotLocal);

  return (
    <Dialog onClose={onClose} open={open}>
      <List sx={{ pt: 0, minWidth: 250 }} disablePadding>
        {filteredPackages.map((pkg) => (
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
        <ListItem disablePadding disableGutters key="add-local">
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
        <ListItem disablePadding disableGutters key="add-relay">
          <ListItemButton
            autoFocus
            onClick={() => fetchPkgFromRelay()}
            style={{ textAlign: "center" }}
          >
            <ListItemIcon>
              <MailIcon />
            </ListItemIcon>

            <ListItemText primary="Import from relay" />
            <span
              style={{
                backgroundColor: newMessage ? "#D32F2F" : "",
                padding: "4px",
                margin: "2px",
                fontSize: "11px",
                fontWeight: "bold",
                color: "white",
                minWidth: "auto",
              }}
              color="error"
            >
              {newMessage}
            </span>
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
  onImportFR: (pkg: TypedPackage[]) => void;
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
  const [message, setMessages] = useState(0);

  const updatePackages = () => setPackages(PackageService.list());
  useEffect(updatePackages, []);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const count = await checkForMessages.valueOfValidCids();
        newMessage = count;
        setMessages(count || 0);
      } catch (error) {
        console.error("Error occurred while checking messages:", error);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

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
      if (pkg == null) return;
      const filteredPackages = pkg.filter((p): p is TypedPackage => p !== null);
      onImportFR(filteredPackages);
    } catch (error) {
      onError(
        "Failed to import ownable",
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
        {/* The notification message */}
        <Badge badgeContent={message} color="error">
          <AddIcon fontSize="large" />
        </Badge>
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
