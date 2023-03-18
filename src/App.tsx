import {useEffect, useState} from 'react';
import {Box, Button, Link, Typography} from "@mui/material";
import PackagesFab from "./components/PackagesFab";
import IDBService from "./services/IDB.service";
import {TypedPackage} from "./interfaces/TypedPackage";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import LTOService from "./services/LTO.service";
import Sidebar from "./components/Sidebar";
import LocalStorageService from "./services/LocalStorage.service";
import SessionStorageService from "./services/SessionStorage.service";
import OwnableService from "./services/Ownable.service";
import If from "./components/If";
import PackageService, {HAS_EXAMPLES} from "./services/Package.service";
import Grid from "@mui/material/Unstable_Grid2";
import * as React from "react";
import Ownable from "./components/Ownable";
import {EventChain} from "@ltonetwork/lto";
import HelpDrawer from "./components/HelpDrawer";
import AppToolbar from "./components/AppToolbar";
import AlertDialog from "./components/AlertDialog";
import {AlertColor} from "@mui/material/Alert/Alert";
import ownableErrorMessage from "./utils/ownableErrorMessage";
import Overlay from "./components/Overlay";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(!LTOService.isUnlocked());
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPackages, setShowPackages] = React.useState(false);
  const [address, setAddress] = useState(LTOService.address);
  const [ownables, setOwnables] = useState<Array<{chain: EventChain, package: string}>>([]);
  const [consuming, setConsuming] = useState<{chain: EventChain, package: string}|null>(null);
  const [alert, setAlert] = useState<{title: string, message: string, severity: AlertColor}|null>(null);

  useEffect(() => {
    IDBService.open()
      .then(() => OwnableService.loadAll())
      .then(ownables => setOwnables(ownables))
      .then(() => setLoaded(true))
  }, []);

  const onError = (title: string, message: string) => {
    setAlert({severity: "error", title, message})
  }

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
    setOwnables([...ownables, {chain, package: pkg.cid}]);
  }

  const deleteOwnable = async (id: string) => {
    setOwnables(current => current.filter(ownable => ownable.chain.id !== id));
    await OwnableService.delete(id);
  }

  const consume = (consumer: EventChain, consumable: EventChain) => {
    if (consumer.id === consumable.id) return;
    OwnableService.consume(consumer, consumable)
      .catch(error => onError("Consume failed", ownableErrorMessage(error)));
  }

  const reset = async () => {
    setOwnables([]);
    setShowSidebar(false);
    await OwnableService.deleteAll();
  }

  const factoryReset = async () => {
    setLoaded(false);

    await IDBService.destroy();
    LocalStorageService.clear();
    SessionStorageService.clear();

    window.location.reload();
  }

  return <>
    <AppToolbar onMenuClick={() => setShowSidebar(true)} />
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
      { ownables.map(({chain, package: packageCid}) =>
        <Grid key={chain.id} xs={12} sm={6} md={4} sx={{position: 'relative'}}>
          <Ownable
            chain={chain}
            packageCid={packageCid}
            selected={consuming?.chain.id === chain.id}
            onDelete={() => deleteOwnable(chain.id)}
            onConsume={() => setConsuming({chain, package: packageCid})}
            onError={onError}
          />
          <Overlay
            hidden={consuming === null}
            sx={{cursor: consuming?.chain.id !== chain.id ? 'pointer' : ''}}
            onClick={() => consume(chain, consuming!.chain)}
          />
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

    <HelpDrawer open={consuming !== null}>
      <Typography component="span" sx={{fontWeight: 700}}>
        Select which Ownable should consume this <em>{consuming ? PackageService.info(consuming.package).name : ''}</em>
      </Typography>
      <Box>
        <Button sx={theme => ({color: theme.palette.primary.contrastText})} onClick={() => setConsuming(null)}>Cancel</Button>
      </Box>
    </HelpDrawer>

    <AlertDialog
      open={alert !== null}
      onClose={() => setAlert(null)}
      {...alert}
    >
      <>{alert?.message}</>
    </AlertDialog>

    <Loading show={!loaded} />
  </>
}
