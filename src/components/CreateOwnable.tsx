import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Hidden,
  IconButton,
  Input,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import GridItem from "@mui/material/Grid";
import LTOService from "../services/LTO.service";
import useInterval from "../utils/useInterval";
import Dialog from "@mui/material/Dialog";
import JSZip from "jszip";
import axios from "axios";
import heic2any from "heic2any";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import DownloadIcon from "@mui/icons-material/Download";
import { Transfer as TransferTx } from "@ltonetwork/lto";
import {
  TypedOwnable,
  TypedReadyOwnable,
} from "../interfaces/TypedOwnableInfo";
import { useSnackbar } from "notistack";
import PackageService from "../services/Package.service";

interface CreateOwnableProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateOwnable(props: CreateOwnableProps) {
  const { open, onClose } = props;
  const [activeTab, setActiveTab] = useState("build");
  const ltoWalletAddress = LTOService.address;
  const [showNoBalance, setShowNoBalance] = useState(false);
  const [balance, setBalance] = useState<number>();
  const [ownable, setOwnable] = useState<TypedOwnable>({
    owner: "",
    email: "",
    name: "",
    description: "",
    keywords: [],
    ethereumAddress: "",
    network: "ethereum",
    image: null,
  });
  const [ownables, setOwnables] = useState<TypedReadyOwnable[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  // const [tx, setTx] = useState<TransferTx | undefined>();
  const [available, setAvailable] = useState(0);
  const [lowBalance, setLowBalance] = useState(false);
  const [amount, setAmount] = useState(0);
  const [showAmount, setShowAmount] = useState<number>(0);
  const [recipient, setShowAddress] = useState<string | undefined>();
  const [noConnection, setNoConnection] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum');

  // const recipient = "3NBq1gTwDg2SfQvArc3C7E9PCFnS7hqqdzo";
  // // const recipient = "3N5vwNey9aFkyrQ5KUzMt3qfuwg5jKKzrLB";
  // // const value = "1";
  // const value = 100000000;
  // const LTO_REPRESENTATION = 100000000;
  // const amount = (Math.floor(parseFloat(value.toString()) / LTO_REPRESENTATION)+1)

  const fetchBuildAmount = useCallback(async () => {
    try {
      const response = await axios.get(
        "http://localhost:3000/api/v1/templateCost?template=1",
        {
          headers: {
            Accept: "*/*",
          },
        }
      );
      console.log("response", response);
      console.log("response.data", response.data[selectedNetwork]);
      const value = +response.data[selectedNetwork];
      console.log("BuildAmount", value);
      const address = await axios.get(
        "http://localhost:3000/api/v1/ServerWalletAddressLTO",
        {
          headers: {
            Accept: "*/*",
          },
        }
      )
      console.log("address", address.data.serverWalletAddressLTO);
      const serverAddress = address.data.serverWalletAddressLTO;
      // for testing now use 3NBq1gTwDg2SfQvArc3C7E9PCFnS7hqqdzo
      // const serverAddress = "3NBq1gTwDg2SfQvArc3C7E9PCFnS7hqqdzo";
      console.log("serverAddress", serverAddress);
      const LTO_REPRESENTATION = 100000000;
      const calculatesAmount =
        // Math.ceil(parseFloat(value.toString()) / LTO_REPRESENTATION) + 1;
        (parseFloat(value.toString()) / LTO_REPRESENTATION) + 1;
      console.log("calculatesAmount", calculatesAmount);
      if (calculatesAmount < 2) {
        console.log("error server is not ready yet");
        return;
      } else {
        setAmount(value);
        setShowAmount(calculatesAmount);
        setShowAddress(serverAddress);
      }
    } catch (error) {
      console.error("Error fetching build amount:", error);
      setNoConnection(true);
    }
  }, [selectedNetwork]);

  useEffect(() => {
    fetchBuildAmount();
  }, [fetchBuildAmount]);

  // useEffect(() => {
  //   if (recipient) {
  //     setTx(new TransferTx(recipient, amount));
  //   }
  // }, [recipient, amount]);

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleClose = () => {
    handleCloseDialog();
    clearFields();
    onClose();
  };

  const { enqueueSnackbar } = useSnackbar();

  const handleCopy = () => {
    navigator.clipboard.writeText(ltoWalletAddress);
    enqueueSnackbar("Address copied to clipboard", { variant: "success" });
  };

  const clearFields = () => {
    setOwnable({
      owner: "",
      email: "",
      name: "",
      description: "",
      keywords: [],
      ethereumAddress: "",
      network: "ethereum",
      image: null,
    });
    setSelectedNetwork('ethereum');
  };

  const loadBalance = () => {
    if (!LTOService.isUnlocked()) return;

    LTOService.getBalance().then(({ regular }) => {
      setBalance(parseFloat((regular / 100000000).toFixed(2)));
      setAvailable(regular);
    });
  };

  useEffect(() => loadBalance(), []);
  useInterval(() => loadBalance(), 5 * 1000);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  useEffect(() => {
    if (balance !== undefined && balance < 0.1) {
      setShowNoBalance(true);
      return;
    }
  }, [balance]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setOwnable((prevOwnable) => ({
      ...prevOwnable,
      [name]: value,
    }));
  };

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const keywords = value.split(" ");
    setOwnable((prevOwnable) => ({
      ...prevOwnable,
      keywords,
    }));
  };

  const handleNetworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setOwnable((prevOwnable) => ({
      ...prevOwnable,
      network: value,
    }));
    fetchBuildAmount();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0] || null;

    if (file && file.type === "image/heic") {
      const blob = await heic2any({
        blob: file,
        toType: "image/png",
        quality: 0.7,
      });
      if (blob instanceof Blob) {
        file = new File([blob], file.name, { type: "image/png" });
      }
    }
    setOwnable((prevOwnable) => ({
      ...prevOwnable,
      image: file,
    }));
  };

  const handleCreateOwnable = async () => {
    const requiredFields = [
      "name",
      "network",
      "ethereumAddress",
      "owner",
      "email",
      "image",
    ];
    let newMissingFields: string[] = [];
    for (let field of requiredFields) {
      if (!ownable[field as keyof TypedOwnable]) {
        console.error(`Missing required field: ${field}`);
        newMissingFields.push(field);
      }
    }
    setMissingFields(newMissingFields);
    if (newMissingFields.length > 0) {
      return;
    }
    if (!recipient || !amount) {
      console.error('Recipient or amount is not defined');
      setNoConnection(true);
      return;
    }
    const tx = new TransferTx(recipient, amount);
    try {
      const account = await LTOService.getAccount();
      const info = await LTOService.broadcast(tx!.signWith(account));
      console.log('Transaction id', info.id);
      console.log('Transaction info', info);
      setTimeout(() => {
        if (info.id) {
          console.log("Transaction id", info.id, "ready");
          const imageType = ownable.image
            ? ownable.image.type.split("/")[1]
            : "";
          const imageName = ownable.name.replace(/\s+/g, "-");
          const formattedName = ownable.name.toLowerCase().replace(/\s+/g, "_");

          const ownableData = [
            {
              template: "template1",
              NFT_BLOCKCHAIN: ownable.network,
              NFT_TOKEN_URI: "https://black-rigid-chickadee-743.mypinata.cloud/ipfs/QmSHE3ReBy7b8kmVVbyzA2PdiYyxWsQNU89SsAnWycwMhB",
              NFT_PUBLIC_USER_WALLET_ADDRESS: ownable.ethereumAddress,
              OWNABLE_THUMBNAIL: imageName + "." + imageType,
              OWNABLE_LTO_TRANSACTION_ID: info.id,
              PLACEHOLDER1_NAME: "ownable_" + formattedName,
              PLACEHOLDER1_DESCRIPTION: ownable.description,
              PLACEHOLDER1_VERSION: "0.1.0",
              PLACEHOLDER1_AUTHORS: ownable.owner + " <" + ownable.email + ">",
              PLACEHOLDER1_KEYWORDS: ownable.keywords,
              PLACEHOLDER2_TITLE: ownable.name,
              PLACEHOLDER2_IMG: imageName + "." + imageType,
              PLACEHOLDER4_TYPE: ownable.name,
              PLACEHOLDER4_DESCRIPTION: ownable.description,
              PLACEHOLDER4_NAME: ownable.name,
            },
          ];

          const zip = new JSZip();
          zip.file("ownableData.json", JSON.stringify(ownableData, null, 2));
          if (ownable.image) {
            zip.file(`${imageName}.${imageType}`, ownable.image);
          }
          console.log("zip", zip);
          zip.generateAsync({ type: "blob" }).then((zipFile: Blob) => {
            // for testing creating download zip file, remove for live version
            // Create a temporary link element
            const link = document.createElement("a");
            link.href = URL.createObjectURL(zipFile);
            link.download = formattedName + ".zip";
            // Simulate a click on the link to trigger the download
            link.click();

            // Send the zip file to the REST API
            // const url = 'http://httpbin.org/post';
            const url = 'http://localhost:3000/api/v1/upload';
            const formData = new FormData();
            formData.append('file', zipFile, formattedName + ".zip");
            axios.post(url, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
                'Accept': '*/*'
              }
            })
            .then(res => {
                console.log(res.data)})
            .catch(err => {
                console.log(err)});
            setOpenDialog(true);
          });
          handleCloseDialog();
        }
      }, 8000);
    } catch (error) {
      console.error("Error sending transaction:", error);
      setLowBalance(true);
    }
  };

  const getOwnables = async () => {
    try {
      // const response = await axios.get("http://localhost:3000/Ownables");
      const response = await axios.get("http://[::1]:3000/api/v1/CIDs");
      console.log("response", response);
      // const data = await response.json();
      setOwnables(response.data);
    } catch (error) {
      console.error("Error fetching ownables:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "import") {
      getOwnables();
    }
  }, [activeTab]);

  const getOwnable = async (ownable: { link: string; name: string }) => {
    try {
      await PackageService.downloadOwnable(ownable);
    } catch (error) {
      console.error("Failed to download ownable:", error);
    }
  };

  return (
    <>
      <Dialog onClose={onClose} open={open}>
        <Box sx={{ maxWidth: "90%", p: 2 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
          >
            <Box component="div" sx={{ mt: 1 }}>
              <Typography sx={{ fontSize: 12 }} color="text.secondary">
                LTO Network address
              </Typography>
              <Typography
                sx={{ fontSize: 12, fontWeight: 600 }}
                component="div"
                onClick={handleCopy}
                style={{ cursor: "pointer" }}
              >
                {ltoWalletAddress}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                balance: {balance !== undefined ? balance + " LTO" : ""}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                build cost:{" "}
                {showAmount !== undefined ? showAmount + " LTO" : ""} (incl.
                Fee: 1 LTO)
              </Typography>
            </Box>
            <Hidden smUp>
              <IconButton onClick={onClose} size="small" sx={{ mr: 2, mt: -1 }}>
                <HighlightOffIcon />
              </IconButton>
            </Hidden>
          </Box>
          <Box
            component="div"
            sx={{ mt: 1, display: "flex", justifyContent: "center" }}
          >
            <Tabs
              value={activeTab}
              onChange={(event, value) => handleTabChange(value)}
            >
              <Tab label="Build" value="build" sx={{ mr: { xs: 1, sm: 2 } }} />
              <Tab
                label="Import"
                value="import"
                sx={{ ml: { xs: 1, sm: 2 } }}
              />
            </Tabs>
          </Box>
          <Box>
            {activeTab === "build" && (
              <Box component="div" sx={{ mt: 2 }}>
                <Box display="flex" flexDirection="column" alignItems="center">
                  <Typography sx={{ fontSize: 12 }} color="text.secondary">
                    Choose your network
                  </Typography>
                  <RadioGroup
                    row
                    name="network"
                    value={ownable.network}
                    // onChange={handleNetworkChange}
                    onChange={(event) => {
                      handleNetworkChange(event);
                      setSelectedNetwork(event.target.value);
                    }}
                    sx={{ justifyContent: "center" }}
                  >
                    <FormControlLabel
                      value="ethereum"
                      // control={<Radio />}
                      control={
                        <Radio
                          sx={{
                            width: { xs: "12px", sm: "16px" },
                            height: { xs: "12px", sm: "16px" },
                          }}
                        />
                      }
                      label={
                        <Typography
                          sx={{
                            fontSize: {
                              xs: "0.7rem",
                              sm: "0.9rem",
                              md: "1.1rem",
                            },
                            ml: 1,
                          }}
                          color="text.secondary"
                        >
                          Ethereum
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      value="arbitrum"
                      // control={<Radio />}
                      control={
                        <Radio
                          sx={{
                            width: { xs: "12px", sm: "16px" },
                            height: { xs: "12px", sm: "16px" },
                          }}
                        />
                      }
                      label={
                        <Typography
                          sx={{
                            fontSize: {
                              xs: "0.7rem",
                              sm: "0.9rem",
                              md: "1.1rem",
                            },
                            ml: 1,
                          }}
                          color="text.secondary"
                        >
                          Arbitrum
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      value="polygon"
                      // control={<Radio />}
                      control={
                        <Radio
                          sx={{
                            width: { xs: "12px", sm: "16px" },
                            height: { xs: "12px", sm: "16px" },
                          }}
                        />
                      }
                      label={
                        <Typography
                          sx={{
                            fontSize: {
                              xs: "0.7rem",
                              sm: "0.9rem",
                              md: "1.1rem",
                            },
                            ml: 1,
                          }}
                          color="text.secondary"
                        >
                          Polygon
                        </Typography>
                      }
                    />
                  </RadioGroup>
                </Box>
                {/* <div className={missingFields.includes("network") ? "error" : ""}>
                  <label>
                    <input
                      type="radio"
                      name="network"
                      value="ethereum"
                      checked={ownable.network === 'ethereum'}
                      onChange={handleNetworkChange}
                    />
                    Ethereum
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="network"
                      value="arbitrumSepolia"
                      checked={ownable.network === 'arbitrumSepolia'}
                      onChange={handleNetworkChange}
                    />
                    Arbitrum
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="network"
                      value="polygon"
                      checked={ownable.network === 'polygon'}
                      onChange={handleNetworkChange}
                    />
                    Polygon
                  </label>
                </div> */}
                {/* <select
                    className={missingFields.includes("network") ? "error" : ""}
                    name="network"
                    value={ownable.network}
                    onChange={handleNetworkChange}
                  >
                    <option value="">Select Network</option>
                    <option value="arbitrumSepolia">Arbitrum</option>
                    <option value="polygon">Polygon</option>
                    <option value="ethereum">Ethereum</option>
                  </select>
                  <br></br> */}
                <br></br>
                <Input
                  error={missingFields.includes("owner")}
                  fullWidth
                  type="text"
                  name="owner"
                  placeholder="Owner name"
                  value={ownable.owner}
                  onChange={handleInputChange}
                  sx={{ fontSize: { xs: "0.8rem", sm: "1rem", md: "1.2rem" } }}
                  required
                />
                <Input
                  error={missingFields.includes("email")}
                  fullWidth
                  type="email"
                  name="email"
                  placeholder="Owner email"
                  value={ownable.email}
                  onChange={handleInputChange}
                  sx={{ fontSize: { xs: "0.8rem", sm: "1rem", md: "1.2rem" } }}
                  required
                />
                <Box component="div" sx={{ mt: 2 }}>
                  <Input
                    error={missingFields.includes("name")}
                    fullWidth
                    type="text"
                    name="name"
                    placeholder="Ownable name"
                    value={ownable.name}
                    onChange={handleInputChange}
                    sx={{
                      fontSize: { xs: "0.8rem", sm: "1rem", md: "1.2rem" },
                    }}
                    required
                  />
                  <Input
                    fullWidth
                    type="text"
                    name="description"
                    placeholder="Description"
                    value={ownable.description}
                    onChange={handleInputChange}
                    sx={{
                      fontSize: { xs: "0.8rem", sm: "1rem", md: "1.2rem" },
                    }}
                    required
                  />
                  <br></br>
                  <Input
                    fullWidth
                    type="text"
                    name="keywords"
                    placeholder="Keywords (separated by spaces)"
                    value={ownable.keywords?.join(" ") ?? ""}
                    onChange={handleKeywordsChange}
                    sx={{
                      fontSize: { xs: "0.8rem", sm: "1rem", md: "1.2rem" },
                    }}
                    required
                  />
                  <br></br>
                  <Input
                    error={missingFields.includes("ethereumAddress")}
                    fullWidth
                    type="text"
                    name="ethereumAddress"
                    placeholder="Ethereum Address"
                    value={ownable.ethereumAddress}
                    onChange={handleInputChange}
                    sx={{
                      fontSize: { xs: "0.8rem", sm: "1rem", md: "1.2rem" },
                    }}
                  />
                  <br></br>
                  {/* <br></br>
                  <select
                    className={missingFields.includes("network") ? "error" : ""}
                    name="network"
                    value={ownable.network}
                    onChange={handleNetworkChange}
                  >
                    <option value="">Select Network</option>
                    <option value="arbitrumSepolia">Arbitrum</option>
                    <option value="polygon">Polygon</option>
                    <option value="ethereum">Ethereum</option>
                  </select>
                  <br></br> */}
                  <br></br>
                  <input
                    className={missingFields.includes("image") ? "error" : ""}
                    type="file"
                    accept="image/*,.heic"
                    onChange={handleImageUpload}
                    style={{ marginBottom: "10px" }}
                  />
                  {ownable.image && (
                    <img
                      src={URL.createObjectURL(ownable.image)}
                      alt="Selected"
                      style={{ width: "100px", height: "auto" }}
                    />
                  )}
                  <Box
                    component="div"
                    sx={{ mt: 1, display: "flex", justifyContent: "center" }}
                  >
                    <Button
                      variant="contained"
                      sx={{ mt: 2 }}
                      onClick={handleCreateOwnable}
                      disabled={
                        isNaN(amount) || amount <= 0 || amount > available
                      }
                    >
                      Create Ownable
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
            {activeTab === "import" && (
              <div>
                <Grid container justifyContent="space-between">
                  <GridItem item xs={3}>
                    <strong>Name</strong>
                  </GridItem>
                  <GridItem item xs={3}>
                    <strong>Status</strong>
                  </GridItem>
                  <GridItem item xs={3}>
                    <strong>Action</strong>
                  </GridItem>
                </Grid>
                {/* </div> */}
                {ownables.length === 0 && (
                  <div>
                    <br></br>No ownables for import yet<br></br>
                    Build your first one
                  </div>
                )}
                {ownables.map((readyOwnable) => (
                  <Grid
                    container
                    justifyContent="space-between"
                    key={readyOwnable.name}
                  >
                    <GridItem item xs={3}>
                      <span>{readyOwnable.name}</span>
                    </GridItem>
                    <GridItem item xs={3}>
                      <span>{readyOwnable.status}</span>
                    </GridItem>
                    <GridItem item xs={3}>
                      <Button
                        disabled={readyOwnable.status !== "ready"}
                        onClick={() => getOwnable(readyOwnable)}
                      >
                        <DownloadIcon />
                      </Button>
                    </GridItem>
                  </Grid>
                ))}
              </div>
            )}
          </Box>
        </Box>
        <Dialog
          open={noConnection}
          hideBackdrop
          onClose={() => setNoConnection(false)}
        >
          <Alert variant="outlined" severity="warning">
            <AlertTitle>No server Connection</AlertTitle>
            The server seems to be down, please try again later.
          </Alert>
        </Dialog>
        <Dialog
          open={showNoBalance}
          hideBackdrop
          onClose={() => setShowNoBalance(false)}
        >
          <Alert variant="outlined" severity="warning">
            <AlertTitle>Your balance is zero</AlertTitle>A minumum of{" "}
            {showAmount + 1} LTO is required to build a ownable.
          </Alert>
        </Dialog>
        <Dialog
          open={lowBalance}
          hideBackdrop
          onClose={() => setLowBalance(false)}
        >
          <Alert variant="outlined" severity="warning">
            <AlertTitle>
              Your balance is to low. A A minumum of {showAmount + 1} LTO is
              required to build a ownable.{" "}
            </AlertTitle>
            Please top up.
          </Alert>
        </Dialog>
        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>Ownable Sent</DialogTitle>
          <DialogContent>
            <DialogContentText>
              The ownable has been successfully sent.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Dialog>
    </>
  );
}
