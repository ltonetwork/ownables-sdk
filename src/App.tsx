import React, {useEffect} from 'react';
import logo from './logo.svg';
import './App.css';
import {AppBar, CircularProgress, Toolbar} from "@mui/material";
import PackagesFab from "./components/PackagesFab";
import IDBService from "./services/IDB.service";

export default function App() {
  const [loaded, setLoaded] = React.useState(false);

  useEffect(() => {
    IDBService.open().then(() => setLoaded(true));
  }, []);

  return loaded ? (
    <>
      <AppBar position="static">
        <Toolbar variant="dense">
          <img src={logo} className="logo" alt="Ownables Logo" />
        </Toolbar>
      </AppBar>

      <PackagesFab />
    </>
  ) : <CircularProgress />
}
