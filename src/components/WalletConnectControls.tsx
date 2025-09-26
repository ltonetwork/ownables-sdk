import { Button, Typography } from '@mui/material';
import InfoOutlineIcon from '@mui/icons-material/InfoOutlined';
import CachedIcon from '@mui/icons-material/Cached';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';

export default function WalletConnectControls() {
  const { disconnect, isLoading } = useDisconnect();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

        if (!connected) {
          return (
            <Button variant="contained" fullWidth onClick={openConnectModal}>
              Connect to wallet
            </Button>
          );
        }

        if (chain?.unsupported) {
          return (
            <Button variant="contained" color="warning" fullWidth onClick={openChainModal}>
              Wrong network — Switch
            </Button>
          );
        }

        return (
          <>
            <Typography sx={{ fontSize: 12, cursor: 'pointer' }} color="text.secondary" onClick={openChainModal}>
              {chain?.name || 'Network'} address <CachedIcon sx={{ fontSize: 12 }} />
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }} component="div" onClick={openAccountModal}>
              {account?.displayName} <InfoOutlineIcon sx={{ fontSize: 14 }} />
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
              balance: {account?.displayBalance}
            </Typography>
            <Button variant="contained" fullWidth onClick={() => disconnect()} disabled={isLoading}>
              {isLoading ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </>
        );
      }}
    </ConnectButton.Custom>
  );
}
