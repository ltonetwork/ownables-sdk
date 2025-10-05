import {
  Box,
  Button,
  Drawer,
  FormControlLabel,
  FormGroup,
  Hidden,
  IconButton,
  Link,
  Switch, Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { ArrowBack } from "@mui/icons-material";
import ltoLogo from "../assets/ltonetwork.png";
import EventChainService from "../services/EventChain.service";
import WalletConnectControls from "./WalletConnectControls";
import { useAccount, useBalance } from "wagmi"
import useEqtyToken from "../hooks/useEqtyToken"

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onFactoryReset: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const { open, onClose, onReset, onFactoryReset } = props;
  const [anchoring, setAnchoring] = useState(EventChainService.anchoring);
  const { address } = useAccount();
  const { data: ethBalance } = useBalance({ address, formatUnits: 'ether', watch: true });
  const { balance: eqtyBalance } = useEqtyToken({ address, watch: true });

  useEffect(() => {
    EventChainService.anchoring = anchoring;
  }, [anchoring]);

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
            <WalletConnectControls>
              <Box sx={{ mt: 1, mb: 4 }}>
                <Typography variant="body2" fontWeight="strong">Balance</Typography>
                <Typography variant="body2">{Number(ethBalance?.formatted).toFixed(4)} {ethBalance?.symbol}</Typography>
                { eqtyBalance !== undefined && <Typography variant="body2">{Number(eqtyBalance?.formatted).toFixed(4)} {eqtyBalance?.symbol}</Typography> }
              </Box>
            </WalletConnectControls>
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
    </>
  );
}
