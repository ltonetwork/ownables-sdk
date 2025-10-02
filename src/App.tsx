import { useEffect, useRef, useState } from "react";
import { Box, Button, Link, Typography } from "@mui/material";
import PackagesFab from "./components/PackagesFab";
import { TypedPackage } from "./interfaces/TypedPackage";
import LoginDialog from "./components/LoginDialog";
import Loading from "./components/Loading";
import LTOService from "./services/LTO.service";
import Sidebar from "./components/Sidebar";
import { ViewMessagesBar } from "./components/ViewMessagesBar";
import If from "./components/If";
import { HAS_EXAMPLES } from "./services/Package.service";
import Grid from "@mui/material/Unstable_Grid2";
import * as React from "react";
import Ownable from "./components/Ownable";
import { EventChain } from "eqty-core";
import HelpDrawer from "./components/HelpDrawer";
import AppToolbar from "./components/AppToolbar";
import AlertDialog from "./components/AlertDialog";
import { AlertColor } from "@mui/material/Alert/Alert";
import ownableErrorMessage from "./utils/ownableErrorMessage";
import Overlay from "./components/Overlay";
import ConfirmDialog from "./components/ConfirmDialog";
import { SnackbarProvider, enqueueSnackbar } from "notistack";
import { TypedOwnableInfo } from "./interfaces/TypedOwnableInfo";
import { usePackageManager } from "./hooks/usePackageManager";
import { useAccount, useNetwork } from 'wagmi';
import { useMessageCount } from "./hooks/useMessageCount";
import { useService } from "./hooks/useService"

export default function App() {
  // Reload app UI when wallet account or chain changes (RainbowKit/wagmi)
  const handleWalletContextChanged = () => {
    // Close all menus and modals
    setShowSidebar(false);
    setShowViewMessagesBar(false);
    setShowPackages(false);
    setConsuming(null);
    setAlert(null);
    setConfirm(null);
    // Force a full reload to reinitialize event chains and ownables
    try {
      // Small timeout to ensure UI state updates flush before reload
      setTimeout(() => {
        window.location.reload();
      }, 0);
    } catch (_) {
      window.location.reload();
    }
  };
  const [loaded, setLoaded] = useState(false);
  const [showLogin, setShowLogin] = useState(!LTOService.isUnlocked());
  const [showSidebar, setShowSidebar] = useState(false);
  const [showViewMessagesBar, setShowViewMessagesBar] = useState(false);
  const [showPackages, setShowPackages] = React.useState(false);
  const [address, setAddress] = useState(LTOService.address);
  const [message, setMessages] = useState(0);
  const [ownables, setOwnables] = useState<
    Array<{ chain: EventChain; package: string; uniqueMessageHash?: string }>
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

  const ownableService = useService('ownables');
  const pollingService = useService('polling');
  const packageService = useService('packages');
  const relayService = useService('relay');
  const storage = useService('localStorage');
  const idb = useService('idb');
  const { isLoading: isPackageManagerLoading } = usePackageManager();

  const handleNotificationClick = () => {
    setShowViewMessagesBar(true);
  };

  const { setMessageCount } = useMessageCount();

  useEffect(() => {
    if (!ownableService) return;

    ownableService.loadAll()
      .then((ownables) => setOwnables(ownables))
      .then(() => setLoaded(true));
  }, [ownableService]);

  useEffect(() => {
    if (pollingService && !showLogin && address.length > 1) {
      const stopPolling = pollingService.startPolling(
        address,
        (newCount: any) => {
          setMessages(newCount);
        },
        5000
      );
      return () => stopPolling();
    }
  }, [address, showLogin, pollingService]);

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

  // When the wallet disconnects (from WalletConnectControls or elsewhere), log out of the app.
  const account = useAccount({
    onDisconnect() {
      logout();
    },
  });
  const wagmiAddress = account.address;
  const { chain } = useNetwork();

  // Detect account/chain changes (RainbowKit/wagmi) and reload the app UI
  const prevAddressRef = useRef<string | undefined>(wagmiAddress);
  const prevChainIdRef = useRef<number | undefined>(chain?.id);

  useEffect(() => {
    if (prevAddressRef.current !== undefined && wagmiAddress !== prevAddressRef.current) {
      handleWalletContextChanged();
    }
    prevAddressRef.current = wagmiAddress;
  }, [wagmiAddress]);

  useEffect(() => {
    if (prevChainIdRef.current !== undefined && chain?.id !== prevChainIdRef.current) {
      handleWalletContextChanged();
    }
    prevChainIdRef.current = chain?.id;
  }, [chain?.id]);

  // Also subscribe to provider-level events for maximal compatibility (e.g., injected provider)
  useEffect(() => {
    const eth: any = (window as any).ethereum;
    if (!eth || !eth.on) return;

    const onAccountsChanged = () => handleWalletContextChanged();
    const onChainChanged = () => handleWalletContextChanged();

    eth.on('accountsChanged', onAccountsChanged);
    eth.on('chainChanged', onChainChanged);

    return () => {
      try {
        eth.removeListener && eth.removeListener('accountsChanged', onAccountsChanged);
        eth.removeListener && eth.removeListener('chainChanged', onChainChanged);
      } catch (_) {
        // no-op
      }
    };
  }, []);

  const removeOwnable = (ownableId: string) => {
    setOwnables((prevOwnables) =>
      prevOwnables.filter((ownable) => ownable.chain.id !== ownableId)
    );
  };

  const forge = async (pkg: TypedPackage) => {
    if (!ownableService) throw new Error("Ownable service not ready");

    try {
      const chain = await ownableService.create(pkg);
      setOwnables([...ownables, { chain, package: pkg.cid }]);
      setShowPackages(false);
      enqueueSnackbar(`${pkg.title} forged`, { variant: "success" });
    } catch (error) {
      showError("Failed to forge ownable", ownableErrorMessage(error));
    }
  };

  const relayImport = async (
    pkg: TypedPackage[] | null,
    triggerRefresh: boolean
  ) => {
    if (!pkg || pkg.length === 0) {
      enqueueSnackbar(`Nothing to Load from relay`, { variant: "error" });
      return;
    }

    try {
      // Process packages
      const validPackages = pkg.filter(
        (data: TypedPackage) => data.chain && data.cid
      );

      setOwnables((prevOwnables) => [
        ...prevOwnables,
        ...validPackages.map((data: TypedPackage) => ({
          chain: data.chain,
          package: data.cid,
          uniqueMessageHash: data.uniqueMessageHash,
        })),
      ]);

      enqueueSnackbar(`Ownable successfully loaded`, { variant: "success" });
      await setMessageCount(0);
      setMessages(0);

      // Trigger a refresh only for updated ownables
      if (triggerRefresh) {
        setAlert({
          severity: "info",
          title: "New Ownables Detected",
          message: "New ownables have been detected. Refreshing...",
        });

        setTimeout(() => {
          window.location.reload();
        }, 7000);
      }
    } catch (error) {
      showError("Failed to import from relay", ownableErrorMessage(error));
    }
  };

  const deleteOwnable = (
    id: string,
    packageCid: string,
    uniqueMessageHash?: string
  ) => {
    if (!packageService) throw new Error("Package service not ready");
    const pkg = packageService.info(packageCid);

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
        if (!ownableService) throw new Error("Ownable service not ready");

        setOwnables((current) =>
          current.filter((ownable) => ownable.chain.id !== id)
        );
        //Delete ownable
        await ownableService.delete(id);

        //delete ownable from relay
        const uniqueMessageHash = pkg.uniqueMessageHash;

        //delete package
        if (pkg.isNotLocal && storage) {
          storage.removeByField(
            "packages",
            "uniqueMessageHash",
            uniqueMessageHash
          );
        }

        if (uniqueMessageHash) {
          await relayService?.removeOwnable(uniqueMessageHash);
        }
      },
    });
  };

  const canConsume = async (consumer: {
    chain: EventChain;
    package: string;
  }): Promise<boolean> => {
    try {
      return Boolean(
        consuming?.info &&
        (await ownableService?.canConsume(consumer, consuming!.info))
      );
    } catch (e) {
      console.error(e, (e as any).cause);
      return false;
    }
  };

  const consume = (consumer: EventChain, consumable: EventChain) => {
    if (consumer.id === consumable.id) return;
    if (!ownableService) throw new Error("Ownable service not ready");

    ownableService.consume(consumer, consumable)
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
        await ownableService?.deleteAll();
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

        storage?.clear();
        await idb?.deleteDatabase();

        window.location.reload();
      },
    });
  };

  return (
    <>
      <AppToolbar
        onMenuClick={() => setShowSidebar(true)}
        onNotificationClick={handleNotificationClick}
        messagesCount={message}
      />
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
              <br />
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
        {ownables.map(({ chain, package: packageCid, uniqueMessageHash }) => (
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
              uniqueMessageHash={uniqueMessageHash}
              selected={consuming?.chain.id === chain.id}
              onDelete={() =>
                deleteOwnable(chain.id, packageCid, uniqueMessageHash)
              }
              onRemove={() => removeOwnable(chain.id)}
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
        onCreate={() => null}
        message={message}
      />

      <Sidebar
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        onReset={reset}
        onFactoryReset={factoryReset}
      />

      <ViewMessagesBar
        open={showViewMessagesBar}
        onClose={() => setShowViewMessagesBar(false)}
        messagesCount={message}
        setOwnables={setOwnables}
      />

      <LoginDialog key={address} open={loaded && showLogin} onLogin={onLogin} />

      <HelpDrawer open={consuming !== null}>
        <Typography component="span" sx={{ fontWeight: 700 }}>
          Select which Ownable should consume this{" "}
          <em>
            {consuming && packageService ? packageService.info(consuming.package).title : ""}
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
      <Loading show={!loaded || isPackageManagerLoading} />
    </>
  );
}
