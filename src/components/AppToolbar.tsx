import React from "react";
import { AppBar, Box, IconButton, Toolbar, Badge, Alert, Chip } from "@mui/material";
import logo from "../assets/logo.svg";
import MenuIcon from "@mui/icons-material/Menu";
import MailOutlinedIcon from "@mui/icons-material/MailOutlined";
import WarningIcon from "@mui/icons-material/Warning";

interface AppToolbarProps {
  onMenuClick: () => void;
  onNotificationClick: () => void;
  messagesCount: number;
  chainId?: number;
  isConnected: boolean;
}

const BASE_SEPOLIA_CHAIN_ID = 84532; // Base Sepolia

export default function AppToolbar({
  onMenuClick,
  onNotificationClick,
  messagesCount,
  chainId,
  isConnected,
}: AppToolbarProps) {
  const isOnBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;
  const showNetworkWarning = isConnected && !isOnBaseSepolia;

  return (
    <>
      {showNetworkWarning && (
        <Alert
          severity="warning"
          icon={<WarningIcon />}
          sx={{
            borderRadius: 0,
            py: 0.5,
            "& .MuiAlert-message": {
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: 1,
            },
          }}
        >
          Please switch to <strong>Base Sepolia</strong> network to use this application.
        </Alert>
      )}
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

          {isConnected && (
            <Chip
              label={isOnBaseSepolia ? "Base Sepolia" : "Wrong Network"}
              color={isOnBaseSepolia ? "success" : "error"}
              size="small"
              sx={{
                mr: 1,
                height: 24,
                fontSize: "0.7rem",
                fontWeight: 500,
              }}
            />
          )}

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
              <MailOutlinedIcon />
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
    </>
  );
}
