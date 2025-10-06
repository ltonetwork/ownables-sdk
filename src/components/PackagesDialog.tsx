import { TypedPackage, TypedPackageStub } from "../interfaces/TypedPackage"
import ListItem from "@mui/material/ListItem"
import { Box, Divider, IconButton, ListItemIcon, Skeleton, Typography } from "@mui/material"
import Dialog from "@mui/material/Dialog"
import CloseIcon from "@mui/icons-material/Close"
import List from "@mui/material/List"
import Tooltip from "./Tooltip"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import If from "./If"
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome"
import DriveFolderUploadIcon from "@mui/icons-material/DriveFolderUpload"
import BuilderService from "../services/Builder.service"

function SkeletonPackageItem() {
  return (
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
          <Skeleton variant="text" width="80%" height={16}/>
          <Skeleton variant="text" width="60%" height={14}/>
        </Box>
      </Box>
    </ListItem>
  );
}

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

export function PackagesDialog(props: PackagesDialogProps) {
  const { onClose, onSelect, onImport, onCreate, open, isLoading } = props;
  const filteredPackages = props.packages.filter((pkg) => !pkg.isNotLocal);
  const hasBuilder = BuilderService.isAvailable();

  return (
    <Dialog onClose={onClose} open={open} maxWidth="sm" fullWidth>
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            Packages
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon/>
          </IconButton>
        </Box>
        <List sx={{ pt: 2 }} disablePadding>
          {isLoading ? (
            <>
              <SkeletonPackageItem/>
              <SkeletonPackageItem/>
              <SkeletonPackageItem/>
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
          <Divider/>
        </If>
        <List sx={{ pt: 0 }} disablePadding>
          <ListItem disablePadding disableGutters key="create-ownable">
            <ListItemButton
              autoFocus
              onClick={onCreate}
              style={{ textAlign: "center" }}
              disabled={!hasBuilder}
            >
              <ListItemIcon>
                <AutoAwesomeIcon/>
              </ListItemIcon>
              <ListItemText primary="Create ownable"/>
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding disableGutters key="add-local">
            <ListItemButton
              autoFocus
              onClick={onImport}
              style={{ textAlign: "center" }}
            >
              <ListItemIcon>
                <DriveFolderUploadIcon/>
              </ListItemIcon>
              <ListItemText primary="Import package"/>
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Dialog>
  );
}
