import React from "react";
import { AppBar, Box, IconButton, Toolbar, Badge } from "@mui/material";
import logo from "../assets/logo.svg";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

interface AppToolbarProps {
  onMenuClick: () => void;
  onNotificationClick: () => void;
  messagesCount: number;
}

export default function AppToolbar({
  onMenuClick,
  onNotificationClick,
  messagesCount,
}: AppToolbarProps) {
  return (
    <AppBar position="static">
      <Toolbar variant="dense">
        <img
          src={logo}
          style={{
            width: 300,
            maxWidth: "calc(100% - 140px)",
            height: "auto",
            padding: "10px 15px",
          }}
          alt="Ownables Logo"
        />

        <Box component="div" sx={{ flexGrow: 1 }}></Box>

        <IconButton
          size="large"
          color="inherit"
          aria-label="messages"
          onClick={onNotificationClick}
        >
          <Badge
            badgeContent={messagesCount}
            sx={{
              "& .MuiBadge-badge": {
                fontSize: 8,
                height: 15,
                minWidth: 15,
              },
            }}
            color="error"
          >
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>

        <IconButton
          size="large"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
