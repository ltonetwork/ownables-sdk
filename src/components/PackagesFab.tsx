import * as React from 'react';
import {Divider, Fab, ListItemIcon} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import Dialog from "@mui/material/Dialog";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import {TypedPackage} from "../interfaces/TypedPackage";
import If from "./If";
import selectFile from "../utils/selectFile";
import PackageService from "../services/Package.service";
import {useEffect} from "react";

interface PackagesDialogProps {
  packages: TypedPackage[];
  open: boolean;
  onClose: () => void;
  onSelect: (pkg: TypedPackage) => void;
  onImport: () => void;
}

function PackagesDialog(props: PackagesDialogProps) {
  const {onClose, onSelect, onImport, open, packages} = props;

  return (
    <Dialog onClose={onClose} open={open}>
      <List sx={{pt: 0}}>
        {packages.map((pkg) => (
          <ListItem disablePadding disableGutters key={pkg.name}>
            <ListItemButton onClick={() => onSelect(pkg)} style={{textAlign: "center"}}>
              <ListItemText primary={pkg.name}/>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <If condition={packages.length > 0}><Divider /></If>
      <List sx={{pt: 0}}>
        <ListItem disablePadding disableGutters key="add">
          <ListItemButton autoFocus onClick={() => onImport()} style={{textAlign: "center"}}>
            <ListItemIcon><AddIcon/></ListItemIcon>
            <ListItemText primary="Import from file"/>
          </ListItemButton>
        </ListItem>
      </List>
    </Dialog>
  );
}

export default function PackagesFab() {
  const fabStyle = {
    position: 'absolute',
    bgcolor: 'common.white',
    bottom: 20,
    right: 20,
  };

  const [open, setOpen] = React.useState(false);
  const [packages, setPackages] = React.useState<TypedPackage[]>([]);

  useEffect(() => { setPackages(PackageService.list()); }, []);

  const importPackages = async () => {
    const files = await selectFile({ accept: '.zip', multiple: true });
    await Promise.all(Array.from(files).map(file => PackageService.import(file)));
    setPackages(PackageService.list());
  }

  return <>
    <Fab sx={fabStyle} aria-label="add" size="large" onClick={() => setOpen(true)}>
      <AddIcon fontSize="large" />
    </Fab>
    <PackagesDialog
      packages={packages}
      open={open}
      onClose={() => setOpen(false)}
      onSelect={() => {}}
      onImport={() => importPackages()} />
  </>
}
