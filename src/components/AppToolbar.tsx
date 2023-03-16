import {AppBar, Box, IconButton, Toolbar} from "@mui/material";
import logo from "../assets/logo.svg";
import MenuIcon from "@mui/icons-material/Menu";
import * as React from "react";

interface AppToolbarProps {
  onMenuClick: () => void
}

export default function AppToolbar(props: AppToolbarProps) {
  return (
    <AppBar position="static">
      <Toolbar variant="dense">
        <img src={logo} style={{ width: 300, maxWidth: 'calc(100% - 140px)', height: 'auto', padding: '10px 15px'}} alt="Ownables Logo" />
        <Box component="div" sx={{ flexGrow: 1 }}></Box>
        <IconButton size="large" color="inherit" aria-label="menu" onClick={props.onMenuClick} >
          <MenuIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
