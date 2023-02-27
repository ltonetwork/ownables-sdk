import React from 'react';
import logo from './logo.svg';
import './App.css';
import {AppBar, Toolbar} from "@mui/material";
import PackagesFab from "./components/PackagesFab";

function App() {
  return (
    <>
      <AppBar position="static">
        <Toolbar variant="dense">
          <img src={logo} className="logo" alt="Ownables Logo" />
        </Toolbar>
      </AppBar>
      <PackagesFab />
    </>
  )
}

export default App;
