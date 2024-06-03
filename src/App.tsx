import { useEffect, useState } from "react";
import { Box, Button, Link, Typography } from "@mui/material";
import PackagesFab from "./components/PackagesFab";
import IDBService from "./services/IDB.service";
import { TypedPackage } from "./interfaces/TypedPackage";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import LTOService from "./services/LTO.service";
import Sidebar from "./components/Sidebar";
import LocalStorageService from "./services/LocalStorage.service";
import SessionStorageService from "./services/SessionStorage.service";
import OwnableService from "./services/Ownable.service";
import If from "./components/If";
import PackageService, { HAS_EXAMPLES } from "./services/Package.service";
import Grid from "@mui/material/Unstable_Grid2";
import * as React from "react";
import Ownable from "./components/Ownable";
import { EventChain } from "@ltonetwork/lto";
import HelpDrawer from "./components/HelpDrawer";
import AppToolbar from "./components/AppToolbar";
import AlertDialog from "./components/AlertDialog";
import { AlertColor } from "@mui/material/Alert/Alert";
import ownableErrorMessage from "./utils/ownableErrorMessage";
import Overlay from "./components/Overlay";
import ConfirmDialog from "./components/ConfirmDialog";
import { SnackbarProvider, enqueueSnackbar } from "notistack";
import { TypedOwnableInfo } from "./interfaces/TypedOwnableInfo";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(!LTOService.isUnlocked());
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPackages, setShowPackages] = React.useState(false);
  const [address, setAddress] = useState(LTOService.address);
  const [ownables, setOwnables] = useState<
    Array<{ chain: EventChain; package: string }>
  >([]);
  const [consuming, setConsuming] = useState<{
    chain: EventChain;
    package: string;
    info: TypedOwnableInfo;
  } | null>(null);
  const [alert, setAlert] = useState<{
    title: string;
    message: React.ReactNode;
    severity: AlertColor;
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: React.ReactNode;
    severity?: AlertColor;
    ok?: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    // IDBService.open();
    // LocalStorageService.clear();
    // SessionStorageService.clear();
    // IDBService.deleteDatabase();
    IDBService.open()
      .then(() => OwnableService.loadAll())
      .then((ownables) => setOwnables(ownables))
      .then(() => setLoaded(true));
  }, []);

  const showError = (title: string, message: string) => {
    setAlert({ severity: "error", title, message });
  };

  const onLogin = () => {
    setShowLogin(false);
    setAddress(LTOService.address);
  };

  const logout = () => {
    setShowSidebar(false);
    LTOService.lock();
    setShowLogin(true);
  };

  const forge = async (pkg: TypedPackage) => {
    const chain = OwnableService.create(pkg);
    setOwnables([...ownables, { chain, package: pkg.cid }]);
    setShowPackages(false);
    enqueueSnackbar(`${pkg.title} forged`, { variant: "success" });
  };

  const isEmpty = (obj: any) => {
    if (Array.isArray(obj)) {
      return obj.length === 0;
    } else if (obj && typeof obj === "object") {
      return Object.keys(obj).length === 0;
    }
    return true;
  };

  const relayImport = async (pkg: any | null) => {
    if (pkg != null && !isEmpty(pkg)) {
      setOwnables((prevOwnables) => [
        ...prevOwnables,
        ...pkg.map((data: any) => {
          return {
            chain: data.chain,
            package: data.cid,
          };
        }),
      ]);
      setShowPackages(false);
      enqueueSnackbar(`Ownable successfully loaded`, {
        variant: "success",
      });
    }
    if (pkg == null) {
      enqueueSnackbar(`Nothing to Load from relay`, {
        variant: "error",
      });
    }
  };

  const deleteOwnable = (id: string, packageCid: string) => {
    const pkg = PackageService.info(packageCid);

    setConfirm({
      severity: "error",
      title: "Confirm delete",
      message: (
        <span>
          Are you sure you want to delete this <em>{pkg.title}</em> Ownable?
        </span>
      ),
      ok: "Delete",
      onConfirm: async () => {
        setOwnables((current) =>
          current.filter((ownable) => ownable.chain.id !== id)
        );
        await OwnableService.delete(id);
        enqueueSnackbar(`${pkg.title} deleted`);
      },
    });
  };

  const canConsume = async (consumer: {
    chain: EventChain;
    package: string;
  }): Promise<boolean> => {
    try {
      return (
        !!consuming?.info &&
        (await OwnableService.canConsume(consumer, consuming!.info))
      );
    } catch (e) {
      console.error(e, (e as any).cause);
      return false;
    }
  };

  const consume = (consumer: EventChain, consumable: EventChain) => {
    if (consumer.id === consumable.id) return;

    OwnableService.consume(consumer, consumable)
      .then(() => {
        setConsuming(null);
        setOwnables((ownables) => [...ownables]);
        enqueueSnackbar("Consumed", { variant: "success" });
      })
      .catch((error) =>
        showError("Consume failed", ownableErrorMessage(error))
      );
  };

  const reset = async () => {
    setShowSidebar(false);
    if (ownables.length === 0) return;

    setConfirm({
      severity: "error",
      title: "Confirm delete",
      message: (
        <span>
          Are you sure you want to delete <strong>all Ownables</strong>?
        </span>
      ),
      ok: "Delete all",
      onConfirm: async () => {
        setOwnables([]);
        await OwnableService.deleteAll();
        enqueueSnackbar("All Ownables are deleted");
      },
    });
  };

  const factoryReset = async () => {
    setShowSidebar(false);

    setConfirm({
      severity: "error",
      title: "Factory reset",
      message: (
        <span>
          Are you sure you want to delete all Ownables, all packages and your
          account? <strong>This is a destructive action.</strong>
        </span>
      ),
      ok: "Delete everything",
      onConfirm: async () => {
        setLoaded(false);

        LocalStorageService.clear();
        SessionStorageService.clear();
        await IDBService.deleteDatabase();

        window.location.reload();
      },
    });
  };

  return (
    <>
      <AppToolbar onMenuClick={() => setShowSidebar(true)} />
      <If condition={ownables.length === 0}>
        <Grid
          container
          spacing={0}
          direction="column"
          alignItems="center"
          justifyContent="center"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: -1,
          }}
        >
          <Grid xs={10}>
            <Typography variant="h3" color="text.primary" textAlign="center">
              Let's get started!
            </Typography>
            <Typography
              variant="subtitle1"
              color="text.secondary"
              textAlign="center"
              sx={{ mt: 2 }}
            >
              Read{" "}
              <Link
                href="https://docs.ltonetwork.com/ownables/what-are-ownables"
                target="_blank"
              >
                the documentation
              </Link>{" "}
              to learn how to issue an Ownable
              <If condition={HAS_EXAMPLES}>
                <br />
                or try one of{" "}
                <Link
                  component="button"
                  onClick={() => setShowPackages(true)}
                  style={{ fontSize: "inherit" }}
                >
                  the examples
                </Link>
              </If>
              .
            </Typography>
          </Grid>
        </Grid>
      </If>

      <Grid
        container
        sx={{ maxWidth: 1400, margin: "auto", mt: 2 }}
        columnSpacing={6}
        rowSpacing={4}
      >
        {ownables.map(({ chain, package: packageCid }) => (
          <Grid
            key={chain.id}
            xs={12}
            sm={6}
            md={4}
            sx={{ position: "relative" }}
          >
            <Ownable
              chain={chain}
              packageCid={packageCid}
              selected={consuming?.chain.id === chain.id}
              onDelete={() => deleteOwnable(chain.id, packageCid)}
              onConsume={(info) =>
                setConsuming({ chain, package: packageCid, info })
              }
              onError={showError}
            >
              <If condition={consuming?.chain.id === chain.id}>
                <Overlay zIndex={1000} />
              </If>
              <If
                condition={
                  consuming !== null && consuming.chain.id !== chain.id
                }
              >
                <Overlay
                  zIndex={1000}
                  disabled={canConsume({ chain, package: packageCid }).then(
                    (can) => !can
                  )}
                  onClick={() => consume(chain, consuming!.chain)}
                />
              </If>
            </Ownable>
          </Grid>
        ))}
      </Grid>

      <PackagesFab
        open={showPackages}
        onOpen={() => setShowPackages(true)}
        onClose={() => setShowPackages(false)}
        onSelect={forge}
        onImportFR={relayImport}
        onError={showError}
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
        <Typography component="span" sx={{ fontWeight: 700 }}>
          Select which Ownable should consume this{" "}
          <em>
            {consuming ? PackageService.info(consuming.package).title : ""}
          </em>
        </Typography>
        <Box>
          <Button
            sx={(theme) => ({ color: theme.palette.primary.contrastText })}
            onClick={() => setConsuming(null)}
          >
            Cancel
          </Button>
        </Box>
      </HelpDrawer>

      <SnackbarProvider />
      <AlertDialog
        open={alert !== null}
        onClose={() => setAlert(null)}
        {...alert!}
      >
        {alert?.message}
      </AlertDialog>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        {...confirm!}
      >
        {confirm?.message}
      </ConfirmDialog>
      <Loading show={!loaded} />
    </>
  );
}
