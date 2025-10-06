import React from 'react';
import ReactDOM from 'react-dom/client';

import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/700.css';
import './index.css';

import App from './App';
import reportWebVitals from './reportWebVitals';
import {createTheme, ThemeProvider} from "@mui/material";

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, walletConnectWallet, coinbaseWallet, ledgerWallet, safeWallet } from '@rainbow-me/rainbowkit/wallets';
import { WagmiConfig, configureChains, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { ServicesProvider } from "./contexts/Services.context"

const theme = createTheme({
  palette: {
    primary: {
      main: '#1caaff',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#666666',
    },
  },
});

const { chains, publicClient } = configureChains([baseSepolia, base], [publicProvider()]);

// Use RainbowKit's default wallet connectors to populate the wallet list (WalletConnect, MetaMask, Coinbase, Ledger, etc.)
const walletConnectProjectId = (process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || '').trim();
if (!walletConnectProjectId) {
  // eslint-disable-next-line no-console
  console.warn('RainbowKit: REACT_APP_WALLETCONNECT_PROJECT_ID is not set. WalletConnect may be unavailable.');
}
const connectors = connectorsForWallets([
  {
    groupName: 'Popular',
    wallets: [
      metaMaskWallet({ projectId: walletConnectProjectId, chains }),
      walletConnectWallet({ projectId: walletConnectProjectId, chains }),
      coinbaseWallet({ appName: 'Ownable SDK', chains }),
      ledgerWallet({ projectId: walletConnectProjectId, chains }),
      safeWallet({ chains }),
    ],
  },
]);

const wagmiConfig = createConfig({ autoConnect: true, connectors, publicClient });

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <ServicesProvider>
          <ThemeProvider theme={theme}>
            <App/>
          </ThemeProvider>
        </ServicesProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
