import React, { useCallback, useEffect, useState} from "react";
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
  Tooltip,
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
import { TypedOwnable, TypedReadyOwnable } from "../interfaces/TypedOwnableInfo";
import { useSnackbar } from "notistack";
import PackageService from "../services/Package.service";
import { TypedPackage } from "../interfaces/TypedPackage";
import IDBService from "../services/IDB.service";
// import OwnableService from "../services/Ownable.service";
import TagInputField from "./TagInputField";
// import { sign } from '@ltonetwork/http-message-signatures';


// export let newMessage: number | null;

interface CreateOwnableProps {
  open: boolean;
  onClose: () => void;
  onSelect: (pkg: TypedPackage) => void;
}

export default function CreateOwnable(props: CreateOwnableProps) {
  const { open, onClose, onSelect } = props;
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
    evmAddress: "",
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
  // const [message, setMessages] = useState(0);
  // const [importOwnable, setImportOwnable] = useState<Array<{chain: EventChain, package: string, keywords:string[]}>>([]);
  // const iframeRef = RefObject<HTMLIFrameElement>;
  // const recipient = "3NBq1gTwDg2SfQvArc3C7E9PCFnS7hqqdzo";
  // // const recipient = "3N5vwNey9aFkyrQ5KUzMt3qfuwg5jKKzrLB";
  // // const value = "1";
  // const value = 100000000;
  // const LTO_REPRESENTATION = 100000000;
  // const amount = (Math.floor(parseFloat(value.toString()) / LTO_REPRESENTATION)+1)
const [thumbnail, setThumbnail] = useState<Blob | null>(null);
const [blurThumbnail, setBlurThumbnail] = useState(false);
const [tags, setTags] = useState<string[]>([]);

const getPlaceholderText = (network: string) => {
  switch (network) {
    case 'ethereum':
      return 'Ethereum Address';
    case 'arbitrum':
      return 'Arbitrum Address';
    // Add more cases as needed
    default:
      return 'Address';
  }
};

  useEffect(() => {
    if (!open) {
      setActiveTab("build");
    }
  }, [open]);

  // useEffect(() => {
  //   const intervalId = setInterval(async () => {
  //     try {
  //       const count = await OwnableService.checkReadyOwnables(ltoWalletAddress);
  //       // newMessage = count;
  //       setMessages(count || 0);
  //     } catch (error) {
  //       console.error("Error occurred while checking messages:", error);
  //     }
  //   }, 5000);

  //   return () => clearInterval(intervalId);
  // }, [ltoWalletAddress]);

  const fetchBuildAmount = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_OBUILDER}/v1/templateCost?templateId=1`,
        // 'http://obuilder-env.eba-ftdayif2.eu-west-1.elasticbeanstalk.com/api/v1/templateCost?templateId=1',
        // 'http://obuilder-env.eba-ftdayif2.eu-west-1.elasticbeanstalk.com/api/v1/templateCost?templateId=1&chain='+selectedNetwork,
        // 'http://localhost:3000/api/v1/templateCost?templateId=1&chain='+selectedNetwork,
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
        `${process.env.REACT_APP_OBUILDER}/v1/ServerWalletAddressLTO`,
        // 'http://obuilder-env.eba-ftdayif2.eu-west-1.elasticbeanstalk.com/api/v1/ServerWalletAddressLTO',
        // "http://localhost:3000/api/v1/ServerWalletAddressLTO",
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
      if (calculatesAmount < 1.1) {
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

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleClose = () => {
    handleCloseDialog();
    clearFields();
    clearImageAndThumbnail(); 
    setBlurThumbnail(false);
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
      evmAddress: "",
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

  // const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const { value } = e.target;
  //   const keywords = value.split(" ");
  //   setOwnable((prevOwnable) => ({
  //     ...prevOwnable,
  //     keywords,
  //   }));
  // };

  const handleNetworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setOwnable((prevOwnable) => ({
      ...prevOwnable,
      network: value,
    }));
    fetchBuildAmount();
  };

  const clearImageAndThumbnail = () => {
    // Set the thumbnail state to null or an initial state
    setThumbnail(null);
  
    // Set the image part of the ownable state to null or an initial state
    setOwnable((prevOwnable) => ({
      ...prevOwnable,
      image: null,
    }));
    // Reset file input
  const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
  if (fileInput) {
    fileInput.value = '';
  }
  
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0] || null;

    if (file && file.type === "image/heic") {
      const blob = await heic2any({
        blob: file,
        toType: "image/webp",
        quality: 0.7,
      });
      if (blob instanceof Blob) {
        file = new File([blob], file.name, { type: "image/webp" });
      }
    }

    if (file) {
      const resizedImage = await resizeImage(file);
      file = new File([resizedImage], file.name, { type: "image/webp" });
      // Create a thumbnail from the resized image
      const thumbnailImage = await createThumbnail(resizedImage);
      setThumbnail(thumbnailImage);
    }

    setOwnable((prevOwnable) => ({
      ...prevOwnable,
      image: file,
    }));
  };

  async function createThumbnail(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // Set thumbnail size
        canvas.width = 50; // Example thumbnail width
        canvas.height = 50; // Example thumbnail height
        ctx!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not create thumbnail blob'));
          }
        }, 'image/webp');
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  // Handler for uploading a different thumbnail
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0] || null;
    if (file && file.type === "image/heic") {
      const blob = await heic2any({
        blob: file,
        toType: "image/webp",
        quality: 0.7,
      });
      if (blob instanceof Blob) {
        file = new File([blob], file.name, { type: "image/webp" });
      }
    }

    if (file) {
      const resizedImage = await resizeImage(file);
      console.log(resizedImage);
      file = new File([resizedImage], file.name, { type: "image/webp" });
      // Create a thumbnail from the resized image
      const thumbnailImage = await createThumbnail(resizedImage);
      setThumbnail(thumbnailImage);
    }
  };

  async function resizeImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // If the image is already square, no need to resize
        if (width === height) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = width;
          canvas.height = height;
          ctx!.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not create blob'));
            }
          },'image/webp');
          // }, file.type);
        } else {
          // Determine the larger dimension and set the canvas size to create a square
          const maxSize = Math.max(width, height);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = maxSize;
          canvas.height = maxSize;
        
          // Fill the canvas with a transparent background
          ctx!.fillStyle = 'rgba(0, 0, 0, 0)';
          ctx!.fillRect(0, 0, maxSize, maxSize);
        
          // Draw the image in the center of the canvas
          const x = maxSize / 2 - width / 2;
          const y = maxSize / 2 - height / 2;
          ctx!.drawImage(img, x, y, width, height);
        
          canvas.toBlob(blob => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not create blob'));
            }
          },'image/webp');
        }
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  
  async function getThumbnailBlob(thumbnail: File | Blob, blur: boolean): Promise<Blob> {
    if (!blur) {
      return thumbnail; // No blur needed, return original
    }
  
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2D context could not be created'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.filter = 'blur(5px)'; // Apply blur effect
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Blob conversion failed'));
          }
        }, 'image/webp');
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(thumbnail);
    });
  }

  const handleCreateOwnable = async () => {
    const requiredFields = [
      "name",
      "network",
      "evmAddress",
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
          const imageType = "webp";
          const imageName = ownable.name.replace(/\s+/g, "-");
          const formattedName = ownable.name.toLowerCase().replace(/\s+/g, "_");

          const ownableData = [
            {
              template: "template1",
              LTO_ADDRESS: ltoWalletAddress,
              NFT_BLOCKCHAIN: ownable.network,
              NFT_TOKEN_URI: "https://black-rigid-chickadee-743.mypinata.cloud/ipfs/QmSHE3ReBy7b8kmVVbyzA2PdiYyxWsQNU89SsAnWycwMhB",
              NFT_PUBLIC_USER_WALLET_ADDRESS: ownable.evmAddress,
              OWNABLE_THUMBNAIL:"thumbnail.webp", 
              OWNABLE_LTO_TRANSACTION_ID: info.id,
              PLACEHOLDER1_NAME: "ownable_" + formattedName,
              PLACEHOLDER1_DESCRIPTION: ownable.description,
              PLACEHOLDER1_VERSION: "0.1.0",
              PLACEHOLDER1_AUTHORS: ownable.owner + " <" + ownable.email + ">",
              // PLACEHOLDER1_KEYWORDS: ownable.keywords,
              PLACEHOLDER1_KEYWORDS: tags,
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

          if (thumbnail) {
            const thumbnailBlob = getThumbnailBlob(thumbnail, blurThumbnail);
            zip.file(`thumbnail.webp`, thumbnailBlob);
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
            const url = `${process.env.REACT_APP_OBUILDER}/v1/upload`;
            // const url = 'http://localhost:3000/api/v1/upload';
            const formData = new FormData();
            formData.append('file', zipFile, formattedName + ".zip");
            // const request = 
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
          // const signedRequest = await sign(request, {signer: account});
          handleCloseDialog();
        }
      }, 1000);
    } catch (error) {
      console.error("Error sending transaction:", error);
      setLowBalance(true);
    }
  };
      const downloadOwnable= async(ownable: {RID: string, CID: string}) => {
        console.log("RID: " + ownable.RID);
        console.log("CID: " + ownable.CID);
        try {
          const pkg = await PackageService.importFromGenerator(ownable.RID, ownable.CID);
          console.log("pkg", pkg);
          if (!pkg) {
            throw new Error("pkg not found");
          }
          console.log("chain: ", pkg.chain);
          onSelect(pkg);
          onClose();
          setActiveTab("build");
        } catch (error) {
          console.error("Failed to download ownable:", error);
        }

      };

  useEffect(() => {
    const getOwnables = async () => {
      try {
        // const response = await axios.get("");
        const response = await axios.get(
          `${process.env.REACT_APP_OBUILDER}/v1/requestIDs?ltoUserAddress=${ltoWalletAddress}`,
        );
          // "http://[::1]:3000/api/v1/requestIDs?ltoUserAddress="+ltoWalletAddress);
        // http://localhost:3000/api/v1/requestIDs?ltoUserAddress=3NCfghPcoym62MrXj6To5uRkiFp4xNDi5LK
        // console.log("response", response);

        // Check if the response contains an error
        if (response.data.error) {
          console.error("Error fetching ownables:", response.data.error);
          return;
        }

        if (response.data.error) {
          console.error("No entries for LTO user address: ", response.data.error);
          return;
        }

        console.log("response data", response.data);

        // Create an array of promises
        const promises = response.data.map(async (ownable: { CID: string }) => {
          const hasStore = await IDBService.hasStore(`package:${ownable.CID}`);
          return hasStore ? null : ownable;
        });

        // Wait for all promises to resolve
        const results = await Promise.all(promises);

        // Filter out null values
        const ownables = results.filter(ownable => ownable !== null);

        // const data = await response.json();
        setOwnables(ownables);
      } catch (error) {
        console.error("Error fetching ownables:", error);
      }
    };
    if (activeTab === "import" || activeTab === "build") {
      getOwnables();
    }
  }, [activeTab, ltoWalletAddress]);

  return (
    <>
      <Dialog onClose={handleClose} open={open}>
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
              <IconButton onClick={handleClose} size="small" sx={{ mr: 2, mt: -1 }}>
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
                sx={{ ml: { xs: 1, sm: 2 },
                  // color: message > 0 ? 'error.main' : 'inherit',
                  // fontWeight: message > 0 ? 'bold' : 'normal',
                }}
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
                    onChange={(event) => {
                      handleNetworkChange(event);
                      setSelectedNetwork(event.target.value);
                    }}
                    sx={{ justifyContent: "center" }}
                  >
                    <FormControlLabel
                      value="ethereum"
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
                  </RadioGroup>
                </Box>
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
                  {/* <Input
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
                  /> */}
                  <br></br>
                  <TagInputField 
                  onTagsChange={setTags}
                  />
                  <br></br>
                  <Input
                    error={missingFields.includes("evmAddress")}
                    fullWidth
                    type="text"
                    name="evmAddress"
                    placeholder={getPlaceholderText(selectedNetwork)}
                    value={ownable.evmAddress}
                    onChange={handleInputChange}
                    sx={{
                      fontSize: { xs: "0.8rem", sm: "1rem", md: "1.2rem" },
                    }}
                  />
                  <br></br>
                  <br></br>
                  <label 
                    htmlFor="fileUpload" 
                    className="custom-file-upload"
                    style={{
                      display: "inline-block",
                      padding: "6px 12px",
                      cursor: "pointer",
                      backgroundColor: "#1cb7ff",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      textAlign: "center",
                      textDecoration: "none",
                      transitionDuration: "0.4s",
                      margin: "10px 0",
                    }}
                    >
                    Choose File
                  </label>
                  <br></br>
                  <input
                    id="fileUpload"
                    className={missingFields.includes("image") ? "error" : ""}
                    type="file"
                    accept="image/*,.heic"
                    onChange={handleImageUpload}
                    style={{ marginBottom: "10px", display: "none"}}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                    {ownable.image && (
                      <div>
                        <img
                          src={URL.createObjectURL(ownable.image)}
                          alt="Selected"
                          style={{ width: "100px", height: "auto" }}
                        />
                      </div>
                    )}
                    {thumbnail && (
                      <>
                      <div style={{ textAlign: 'center' }}>
                        {/* <div>Wallet thumbnail</div>  */}
                        <div style={{fontSize: "smaller", lineHeight: "1"}}>
                          Wallet<br />
                          thumbnail
                        </div>
                        <img
                          src={URL.createObjectURL(thumbnail)}
                          alt="Thumbnail"
                          style={{ width: "50px", height: "auto", filter: blurThumbnail ? "blur(5px)" : "none" }}
                        />
                      </div>
                     </>
                    )}
                  </div>
                  <br></br>
                  {/* <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}> */}
                  {thumbnail && (
                    <>
                    <Button onClick={() => setBlurThumbnail(!blurThumbnail)}>
                      {/* <Button onClick={() => setBlurThumbnail(!blurThumbnail)}
                        style={{
                          display: "inline-block",
                          padding: "6px 12px",
                          cursor: "pointer",
                          backgroundColor: "#1cb7ff",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          textAlign: "center",
                          textDecoration: "none",
                          transitionDuration: "0.4s",
                          margin: "10px 0",
                        }}
                        > */}
                      {blurThumbnail ? "Unblur Thumbnail" : "Blur Thumbnail"}
                    </Button>
                    <br></br>
                    {/* <Button style={{
                      padding: "0", // Reset padding to avoid affecting the label's styling
                      backgroundColor: "transparent", // Make the button background transparent
                      border: "none", // Remove border to make it invisible
                      cursor: "pointer", // Optional: ensure it's clear it's clickable
                    }}> */}
                    <Button>
                    <label 
                    htmlFor="thumbUpload" 
                    className="custom-file-upload"
                    // style={{
                    //   display: "inline-block",
                    //   padding: "6px 12px",
                    //   cursor: "pointer",
                    //   backgroundColor: "#1cb7ff",
                    //   color: "#fff",
                    //   border: "none",
                    //   borderRadius: "4px",
                    //   textAlign: "center",
                    //   textDecoration: "none",
                    //   transitionDuration: "0.4s",
                    //   margin: "10px 0",
                    // }}
                    >
                    Change Thumbnail
                  </label>
                  </Button>
                    <input
                    id="thumbUpload"
                    type="file"
                    accept="image/*,.heic"
                    onChange={handleThumbnailUpload}
                    style={{ marginBottom: "10px", display: "none"}}
                  />
                    </>
                    )}
                    {/* </div> */}
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
                  <GridItem item xs={8}>
                    <strong>Name</strong>
                  </GridItem>
                  {/* <GridItem item xs={3}>
                    <strong>Status</strong>
                  </GridItem> */}
                  {/* <GridItem item xs={2}>
                    <strong>Action</strong>
                  </GridItem> */}
                </Grid>
                {ownables.hasOwnProperty('error') || ownables.length === 0 ? (
                  <div>
                    <br></br>No ownables ready for import<br></br>
                  </div>
                ):(
                  ownables.sort((a, b) => (a.CLAIMED === b.CLAIMED ? 0 : a.CLAIMED ? 1 : -1)).map((readyOwnable) => (
                    <Grid
                    container
                    justifyContent="space-between"
                    alignItems="center"
                    key={readyOwnable.RID}
                  >
                    <GridItem item xs={8}>
                      <Tooltip title={readyOwnable.NAME.replace('ownable_', '').split('_').join(' ')}>
                        <Typography noWrap>{readyOwnable.NAME.replace('ownable_', '').split('_').join(' ')}</Typography>
                      </Tooltip>
                    </GridItem>
                    <GridItem item xs={2}>
                      {readyOwnable.NFT_BLOCKCHAIN === 'ethereum' && <img src="/ethereum-logo-grey.svg" alt="Ethereum logo" width="20" height="20"/>}
                      {readyOwnable.NFT_BLOCKCHAIN === 'arbitrum' && <img src="/arbitrum-logo.svg" alt="Arbitrum logo" width="20" height="20"/>}
                      {/* {readyOwnable.NFT_BLOCKCHAIN === 'polygon' && <img src="/polygon-logo.svg" alt="Polygon logo" />} */}
                    </GridItem>
                    <GridItem item xs={2}>
                      <Button
                        onClick={() => downloadOwnable(readyOwnable)}
                        style={{ color: readyOwnable.CLAIMED ? "grey" : "black" }}
                      >
                        <DownloadIcon />
                        {!readyOwnable.CLAIMED && (
                          <span
                            style={{
                              position: "absolute",
                              top: "5px",
                              right: "25px",
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              backgroundColor: "red",
                            }}
                          />
                        )}
                      </Button>
                    </GridItem>
                  </Grid>
                ))
                )}
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
