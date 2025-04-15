import {
  Divider,
  Fab,
  ListItemIcon,
  Box,
  Typography,
  IconButton,
  Skeleton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Dialog from "@mui/material/Dialog";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { TypedPackage, TypedPackageStub } from "../interfaces/TypedPackage";
import If from "./If";
import selectFile from "../utils/selectFile";
import Tooltip from "./Tooltip";
import Loading from "./Loading";
import { enqueueSnackbar } from "notistack";
import { usePackageManager } from "../hooks/usePackageManager";

const SkeletonPackageItem = () => (
  <ListItem
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      mb: 2,
      borderBottom: "1px solid #ddd",
      pb: 2,
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
      <Skeleton
        variant="rectangular"
        width={35}
        height={35}
        sx={{ borderRadius: "10%" }}
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="80%" height={16} />
        <Skeleton variant="text" width="60%" height={14} />
      </Box>
    </Box>
  </ListItem>
);

interface PackagesDialogProps {
  packages: Array<TypedPackage | TypedPackageStub>;
  open: boolean;
  onClose: () => void;
  onSelect: (pkg: TypedPackage | TypedPackageStub) => void;
  onImport: () => void;
  fetchPkgFromRelay: () => void;
  onCreate: () => void;
  message: number;
  isLoading: boolean;
}

function PackagesDialog(props: PackagesDialogProps) {
  const { onClose, onSelect, onImport, onCreate, open, isLoading } = props;
  const filteredPackages = props.packages.filter((pkg) => !pkg.isNotLocal);

  return (
    <Dialog onClose={onClose} open={open} maxWidth="sm" fullWidth>
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            Packages
          </Typography>
          <IconButton onClick={onClose}>
            <ArrowBack />
          </IconButton>
        </Box>
        <List sx={{ pt: 2 }} disablePadding>
          {isLoading ? (
            <>
              <SkeletonPackageItem />
              <SkeletonPackageItem />
              <SkeletonPackageItem />
            </>
          ) : (
            filteredPackages.map((pkg) => (
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
            ))
          )}
        </List>
        <If condition={props.packages.length > 0}>
          <Divider />
        </If>
        <List sx={{ pt: 0 }} disablePadding>
          <ListItem disablePadding disableGutters key="add-local">
            <ListItemButton
              autoFocus
              onClick={onImport}
              style={{ textAlign: "center" }}
            >
              <ListItemIcon>
                <AddIcon />
              </ListItemIcon>
              <ListItemText primary="Import from local" />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding disableGutters key="create-ownable">
            <ListItemButton
              autoFocus
              onClick={onCreate}
              style={{ textAlign: "center" }}
            >
              <ListItemIcon>
                <AddIcon />
              </ListItemIcon>
              <ListItemText primary="Create ownable" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Dialog>
  );
}

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

  const { open, onOpen, onClose, onSelect, onImportFR, onError, message } =
    props;
  const { packages, isLoading, importPackage, importInbox, downloadExample } =
    usePackageManager();

  const importPackages = async () => {
    const files = await selectFile({ accept: ".zip", multiple: true });
    if (files.length === 0) return;

    try {
      await Promise.all(Array.from(files).map((file) => importPackage(file)));
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
        onImport={importPackages}
        fetchPkgFromRelay={importPackagesFromRelay}
        onCreate={props.onCreate}
        message={message}
        isLoading={isLoading}
      />
      <Loading show={isLoading} />
    </>
  );
}
