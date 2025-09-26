import {
  Alert,
  AlertTitle,
  Box,
  Button,
  DialogActions,
  Drawer,
  FormControlLabel,
  FormGroup,
  Hidden,
  IconButton,
  Link,
  Switch,
  Typography,
} from "@mui/material";
import LTOService from "../services/LTO.service";
import { useEffect, useState } from "react";
import useInterval from "../utils/useInterval";
import { ArrowBack } from "@mui/icons-material";
import ltoLogo from "../assets/ltonetwork.png";
import ltoExplorerIcon from "../assets/explorer-icon.png";
import ltoWalletIcon from "../assets/wallet-icon.png";
import Dialog from "@mui/material/Dialog";
import EventChainService from "../services/EventChain.service";
import WalletConnectControls from "./WalletConnectControls"

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onReset: () => void;
  onFactoryReset: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const { open, onClose, onLogout, onReset, onFactoryReset } = props;
  const [anchoring, setAnchoring] = useState(EventChainService.anchoring);
  const [showNoBalance, setShowNoBalance] = useState(false);
  const [balance, setBalance] = useState<number>();

  const loadBalance = () => {
    if (!LTOService.isUnlocked()) return;

    LTOService.getBalance().then(({ regular }) =>
      setBalance(parseFloat((regular / 100000000).toFixed(2)))
    );
  };

  useEffect(() => loadBalance(), []);
  useInterval(() => loadBalance(), 5 * 1000);

  useEffect(() => {
    if (anchoring && balance !== undefined && balance < 0.1) {
      setShowNoBalance(true);
      setAnchoring(false);
      return;
    }

    EventChainService.anchoring = anchoring;
  }, [anchoring, balance]);

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose}>
        <Box sx={{ width: 350, p: 2 }} role="presentation">
          <Box component="div">
            <Hidden smUp>
              <IconButton onClick={onClose} size="small" sx={{ mr: 2 }}>
                <ArrowBack />
              </IconButton>
            </Hidden>
            <Link href="https://ltonetwork.com" target="_blank">
              <img
                src={ltoLogo}
                alt="LTO Network"
                style={{ width: 150, maxWidth: "100%", verticalAlign: -5 }}
              />
            </Link>
          </Box>

          <Box component="div" sx={{ mt: 2 }}>
            <WalletConnectControls />
          </Box>

          <Box component="div" sx={{ mt: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={anchoring}
                  onChange={(e) => setAnchoring(e.target.checked)}
                />
              }
              label="Anchor events"
              sx={{ mb: 1 }}
            />
          </Box>
        </Box>

        <Box component="div" sx={{ flexGrow: 1 }}></Box>

        <Box sx={{ width: 350, p: 2 }} role="presentation">
          <FormGroup>
            <Button
              variant="contained"
              size="small"
              color="error"
              onClick={onReset}
              sx={{ mb: 1 }}
            >
              Delete all Ownables
            </Button>
            <Button
              variant="text"
              size="small"
              color="error"
              fullWidth
              onClick={onFactoryReset}
            >
              Factory Reset
            </Button>
          </FormGroup>
        </Box>
      </Drawer>

      <Dialog
        open={showNoBalance}
        hideBackdrop
        onClose={() => setShowNoBalance(false)}
      >
        <Alert variant="outlined" severity="warning">
          <AlertTitle>Your balance is zero</AlertTitle>
          Anchoring on testnet requires LTO tokens. Please join{" "}
          <strong>LTO Tech Lab</strong> on Telegram and ask for testnet tokens.{" "}
          <em>They will be supplied to you for free.</em>
          <DialogActions sx={{ pb: 0 }}>
            <Button
              variant="text"
              size="small"
              href="https://t.me/ltotech"
              target="_blank"
            >
              Join Telegram Group
            </Button>
          </DialogActions>
        </Alert>
      </Dialog>
    </>
  );
}
