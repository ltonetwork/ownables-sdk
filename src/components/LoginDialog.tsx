import LTOService from "../services/LTO.service";
import {
  Dialog,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Grid,
  Box,
} from "@mui/material";
import bgImage from "../assets/login-bg.jpg";
import { useEffect, useState } from "react";
import { useAccount } from 'wagmi';
import WalletConnectControls from './WalletConnectControls';

const cardStyle = {
  width: 500,
  maxWidth: "calc(100vw - 64px)",
};

interface LoginDialogProps {
  open: boolean;
  onLogin: () => void;
}

export default function LoginDialog(props: LoginDialogProps) {
  const { open, onLogin } = props;
  const { isConnected } = useAccount();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (open && isConnected && !handled) {
      try {
        // Create a random LTO account in the background and store it with a temp password
        LTOService.createAccount();
        LTOService.storeAccount('default', 'eth-temp');
        setHandled(true);
        onLogin();
      } catch (e) {
        console.error('Failed to initialize LTO account after wallet connect', e);
      }
    }
  }, [open, isConnected, handled, onLogin]);

  return (
    <Dialog open={open}>
      <Card style={cardStyle}>
        <CardMedia sx={{ height: 200 }} image={bgImage} />
        <CardContent style={{ textAlign: "center" }}>
          <h1 style={{ marginTop: 6, marginBottom: 0 }}>Ownable SDK Wallet</h1>
        </CardContent>
        <CardActions style={{ paddingBottom: 14 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <WalletConnectControls />
              </Grid>
            </Grid>
          </Box>
        </CardActions>
      </Card>
    </Dialog>
  );
}
