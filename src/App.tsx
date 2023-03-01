import {useEffect, useState} from 'react';
import logo from './assets/logo.svg';
import './App.css';
import {AppBar, Box, IconButton, Toolbar} from "@mui/material";
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


function forge(pkg: TypedPackage) {

}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(!LTOService.isUnlocked());
  const [showSidebar, setShowSidebar] = useState(false);
  const [address, setAddress] = useState(LTOService.address);
  const [ownables, setOwnables] = useState<string[]>([]);

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

  const reset = async () => {
    setShowSidebar(false);
    await OwnableService.deleteAll();
    setOwnables([]);
  }

  const factoryReset = async () => {
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

    <PackagesFab onSelect={forge} />

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
