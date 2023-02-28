import {useEffect, useState} from 'react';
import logo from './assets/logo.svg';
import './App.css';
import {AppBar, Toolbar} from "@mui/material";
import PackagesFab from "./components/PackagesFab";
import IDBService from "./services/IDB.service";
import {TypedPackage} from "./interfaces/TypedPackage";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import LTOService from "./services/LTO.service";

function forge(pkg: TypedPackage) {

}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(!LTOService.isUnlocked());
  const [ownables, setOwnables] = useState<string[]>([]);

  useEffect(() => {
    IDBService.open().then(() => setLoaded(true));
  }, []);

  return <>
    <AppBar position="static">
      <Toolbar variant="dense">
        <img src={logo} className="logo" alt="Ownables Logo" />
      </Toolbar>
    </AppBar>

    <PackagesFab onSelect={forge} />
    <LoginDialog open={loaded && showLogin} onLogin={() => {setShowLogin(false)}} />
    <Loading show={!loaded} />
  </>
}
