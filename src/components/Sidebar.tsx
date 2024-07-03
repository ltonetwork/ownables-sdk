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
  Badge
} from "@mui/material";
import LTOService from "../services/LTO.service";
import {useEffect, useState} from "react";
import useInterval from "../utils/useInterval";
import {ArrowBack} from "@mui/icons-material";
import ltoLogo from "../assets/ltonetwork.png";
import ltoExplorerIcon from "../assets/explorer-icon.png";
import ltoWalletIcon from "../assets/wallet-icon.png";
import Dialog from "@mui/material/Dialog";
import EventChainService from "../services/EventChain.service";
import OwnableService from "../services/Ownable.service";

export let newMessage: number | null;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onReset: () => void;
  onFactoryReset: () => void;
  onCreate: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const {open, onClose, onLogout, onReset, onFactoryReset, onCreate} = props;
  const [anchoring, setAnchoring] = useState(EventChainService.anchoring);
  const [showNoBalance, setShowNoBalance] = useState(false);
  const address = LTOService.address;
  const [balance, setBalance] = useState<number>();
  const [message, setMessages] = useState(0);

  const loadBalance = () => {
    if (!LTOService.isUnlocked()) return;

    LTOService.getBalance().then(({regular}) => setBalance(
      parseFloat((regular / 100000000).toFixed(2))
    ));
  }

  useEffect(() => loadBalance(), []);
  useInterval(() => loadBalance(), 5 * 1000)

  useEffect(() => {
    if (anchoring && balance !== undefined && balance < 0.1) {
      setShowNoBalance(true);
      setAnchoring(false);
      return;
    }

    EventChainService.anchoring = anchoring;
  }, [anchoring, balance]);


  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const count = await OwnableService.checkReadyOwnables(address);
        newMessage = count;
        setMessages(count || 0);
      } catch (error) {
        console.error("Error occurred while checking messages:", error);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [address]);

  return <>
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 350, p: 2 }} role="presentation">
        <Box component="div">
          <Hidden smUp><IconButton onClick={onClose} size="small" sx={{mr: 2}}><ArrowBack /></IconButton></Hidden>
          <Link href="https://ltonetwork.com" target="_blank">
            <img src={ltoLogo} alt="LTO Network" style={{ width: 150, maxWidth: '100%', verticalAlign: -5 }} />
          </Link>
        </Box>

        <Box component="div" sx={{mt: 2}}>
          <Typography sx={{ fontSize: 12 }} color="text.secondary">
            LTO Network address
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }} component="div">
            { address }
          </Typography>
          <Typography variant="body2" sx={{mt: 1}}>
            balance: { balance !== undefined ? balance + ' LTO' : '' }
          </Typography>
          <Button variant="contained" fullWidth sx={{mt: 2}} onClick={onLogout}>Logout</Button>
        </Box>

        <Box component="div" sx={{mt: 4}}>
          <FormControlLabel control={<Switch checked={anchoring} onChange={e => setAnchoring(e.target.checked)} />} label="Anchor events" sx={{mb: 1}} />

          <Typography sx={{ fontSize: 14 }} gutterBottom>
            <Link href={process.env.REACT_APP_LTO_EXPLORER_URL} target="_blank" underline="none" color="inherit" style={{display: "block"}}>
              <img src={ltoExplorerIcon} style={{width: 20, marginRight: 3, verticalAlign: -3}} alt="Explorer icon" /> LTO Testnet Explorer
            </Link>
          </Typography>
          <Typography sx={{ fontSize: 14 }} gutterBottom>
            <Link href={process.env.REACT_APP_LTO_WALLET_URL} target="_blank" underline="none" color="inherit" style={{display: "block"}}>
              <img src={ltoWalletIcon} style={{width: 20, marginRight: 3, verticalAlign: -3}} alt="Wallet icon" /> LTO Testnet Wallet
            </Link>
          </Typography>
        </Box>
        <Box component="div" sx={{mt: 2}}>
        <Box sx={{ position: 'relative' }}>
          <Button  variant="contained" fullWidth sx={{mt: 2}} color="secondary" onClick={onCreate}>Create Ownable</Button>
          <Badge 
            badgeContent={message} 
            color="error" 
            sx={{ 
              position: 'absolute', 
              top: 20, 
              right: 5 
            }}
          />
          </Box>
        </Box>
      </Box>

      <Box component="div" sx={{ flexGrow: 1 }}></Box>

      <Box sx={{ width: 350, p: 2 }} role="presentation">
        <FormGroup>
          <Button variant="contained" size="small" color="error" onClick={onReset} sx={{mb: 1}}>Delete all Ownables</Button>
          <Button variant="text" size="small" color="error" fullWidth onClick={onFactoryReset}>Factory Reset</Button>
        </FormGroup>
      </Box>
    </Drawer>

    <Dialog open={showNoBalance} hideBackdrop onClose={() => setShowNoBalance(false)}>
      <Alert variant="outlined" severity="warning">
        <AlertTitle>Your balance is zero</AlertTitle>
        Anchoring on testnet requires LTO tokens. Please join <strong>LTO Tech Lab</strong> on Telegram and ask for
        testnet tokens. <em>They will be supplied to you for free.</em>
        <DialogActions sx={{pb: 0}}>
          <Button variant="text" size="small" href="https://t.me/ltotech" target="_blank">Join Telegram Group</Button>
        </DialogActions>
      </Alert>
    </Dialog>
  </>
}
