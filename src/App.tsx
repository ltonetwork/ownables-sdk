import {useEffect, useState} from 'react';
import logo from './assets/logo.svg';
import './App.css';
import {AppBar, Box, IconButton, Link, Toolbar, Typography} from "@mui/material";
import PackagesFab from "./components/PackagesFab";
import IDBService from "./services/IDB.service";
import {TypedPackage} from "./interfaces/TypedPackage";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import LTOService from "./services/LTO.service";
import MenuIcon from '@mui/icons-material/Menu';
import Sidebar from "./components/Sidebar";
import LocalStorageService from "./services/LocalStorage.service";
import SessionStorageService from "./services/SessionStorage.service";
import OwnableService from "./services/Ownable.service";
import If from "./components/If";
import {HAS_EXAMPLES} from "./services/Package.service";
import Grid from "@mui/material/Unstable_Grid2";
import * as React from "react";
import Ownable from "./components/Ownable";
import {EventChain} from "@ltonetwork/lto";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(!LTOService.isUnlocked());
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPackages, setShowPackages] = React.useState(false);
  const [address, setAddress] = useState(LTOService.address);
  const [ownables, setOwnables] = useState<{chain: EventChain, pkg: string}[]>([]);

  useEffect(() => {
    IDBService.open().then(() => setLoaded(true));
  }, []);

  const onLogin = () => {
    setShowLogin(false);
    setAddress(LTOService.address);
  }

  const logout = () => {
    setShowSidebar(false);
    LTOService.lock();
    setShowLogin(true);
  }

  const forge = (pkg: TypedPackage) => {
    const chain = OwnableService.create();
    setOwnables([...ownables, {chain, pkg: pkg.key}]);
  }

  const reset = async () => {
    setOwnables([]);
    setShowSidebar(false);
    await OwnableService.deleteAll();
  }

  const factoryReset = async () => {
    setOwnables([]);
    setShowSidebar(false);

    await IDBService.destroy();
    LocalStorageService.clear();
    SessionStorageService.clear();

    setAddress('');
    setShowLogin(true);
  }

  return <>
    <AppBar position="static">
      <Toolbar variant="dense">
        <img src={logo} className="logo" alt="Ownables Logo" />
        <Box component="div" sx={{ flexGrow: 1 }}></Box>
        <IconButton size="large" color="inherit" aria-label="menu" onClick={() => setShowSidebar(true)} >
          <MenuIcon />
        </IconButton>
      </Toolbar>
    </AppBar>

    <If condition={ownables.length === 0}>
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: -1 }}
      >
        <Grid xs={10}>
          <Typography variant="h3" color="text.primary" textAlign="center">Let's get started!</Typography>
          <Typography variant="subtitle1" color="text.secondary" textAlign="center" sx={{mt: 2}}>
            Read <Link href="https://docs.ltonetwork.com/ownables/what-are-ownables" target="_blank">the documentation</Link> to learn how to issue an Ownable
            <If condition={HAS_EXAMPLES}><br />or try one of <Link component="button" onClick={() => setShowPackages(true)} style={{fontSize: 'inherit'}}>the examples</Link></If>.
          </Typography>
        </Grid>
      </Grid>
    </If>

    <Grid container sx={{maxWidth: 1400, margin: 'auto', mt: 2}} columnSpacing={6} rowSpacing={4}>
      { ownables.map(({chain, pkg}) =>
        <Grid key={chain.id} xs={12} sm={6} md={4}>
          <Ownable chain={chain} pkgKey={pkg} />
        </Grid>
      )}
    </Grid>

    <PackagesFab
      open={showPackages}
      onOpen={() => setShowPackages(true)}
      onClose={() => setShowPackages(false)}
      onSelect={forge}
    />

    <Sidebar
      open={showSidebar}
      onClose={() => setShowSidebar(false)}
      onLogout={logout}
      onReset={reset}
      onFactoryReset={factoryReset}
    />
    <LoginDialog key={address} open={loaded && showLogin} onLogin={onLogin} />

    <Loading show={!loaded} />
  </>
}
