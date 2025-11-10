import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import { useService } from "../hooks/useService";
import { useAccount, useChainId } from "wagmi";
import { parseEther, formatEther } from "viem";

interface CreateOwnableDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateOwnableDialog({
  open,
  onClose,
  onSuccess,
}: CreateOwnableDialogProps) {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [templateCost, setTemplateCost] = useState<{
    eth: string;
    usd?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const builderService = useService("builder");
  const { address } = useAccount();
  const chainId = useChainId();
  const hasFetchedRef = useRef(false);

  const DEFAULT_TEMPLATE_ID = 1;
  const BASE_SEPOLIA_CHAIN_ID = 84532;
  const isTestnet = chainId === BASE_SEPOLIA_CHAIN_ID;

  // Load template cost when dialog opens (only once per open)
  useEffect(() => {
    if (!open || !builderService) {
      hasFetchedRef.current = false;
      return;
    }

    // Only fetch once per dialog open
    if (hasFetchedRef.current) {
      return;
    }

    hasFetchedRef.current = true;
    let cancelled = false;

    builderService
      .getTemplateCost(DEFAULT_TEMPLATE_ID)
      .then((cost) => {
        if (!cancelled) {
          setTemplateCost(cost);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load template cost:", err);
          setTemplateCost({ eth: "0.001" }); // Default fallback
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // Only depend on open, not builderService to avoid multiple calls

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Only allow alphanumeric characters (a-z, A-Z, 0-9)
    const sanitized = inputValue.replace(/[^a-zA-Z0-9]/g, "");
    setName(sanitized);

    // Show error if user tried to input invalid characters
    if (inputValue !== sanitized) {
      setNameError(
        "Name can only contain letters and numbers (no spaces, emojis, or special characters)"
      );
    } else {
      setNameError(null);
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Allow alphanumeric, spaces, and basic punctuation (periods, commas, hyphens, apostrophes, exclamation, question marks)
    // Block emojis and other special characters
    const sanitized = inputValue.replace(/[^\w\s.,!?'-]/g, "");
    setDescription(sanitized);

    // Show error if user tried to input invalid characters
    if (inputValue !== sanitized) {
      setDescriptionError(
        "Description cannot contain emojis or special characters"
      );
    } else {
      setDescriptionError(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "image/gif",
      "image/webp",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];
    if (!validTypes.includes(file.type)) {
      setError(
        "Invalid file type. Please upload a GIF, WebP, PNG, or JPEG image."
      );
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!builderService) {
      enqueueSnackbar("Builder service not available", { variant: "error" });
      return;
    }

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!imageFile) {
      setError("Image is required");
      return;
    }

    if (!address) {
      setError("Wallet not connected");
      return;
    }

    const eth = (window as any).ethereum;
    if (!eth) {
      setError("MetaMask not found");
      return;
    }

    try {
      setError(null);

      // Step 1: Switch to correct chain if needed
      const ltoNetworkId = builderService.getLtoNetworkId();
      const expectedChainId =
        ltoNetworkId === "L"
          ? "0x2105" // Base Mainnet
          : "0x14a34"; // Base Sepolia

      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: expectedChainId }],
        });
      } catch (switchError: any) {
        if (switchError?.code === 4902) {
          throw new Error(
            `Please add Base ${
              ltoNetworkId === "L" ? "Mainnet" : "Sepolia"
            } to MetaMask first`
          );
        }
        throw switchError;
      }

      let txHash: string | undefined;

      // Step 2: Send payment transaction (skip on testnet)
      if (!isTestnet) {
        setIsProcessingPayment(true);

        // Get server wallet address and template cost
        const serverAddress = await builderService.getAddress();
        if (!serverAddress) {
          throw new Error("Failed to get server wallet address");
        }

        if (
          !serverAddress ||
          !serverAddress.startsWith("0x") ||
          serverAddress.length !== 42
        ) {
          throw new Error(`Invalid server wallet address: ${serverAddress}`);
        }

        // Send payment transaction
        const cost = templateCost?.eth || "0.001";
        const costWei = parseEther(cost);
        const costHex = `0x${costWei.toString(16)}`;

        enqueueSnackbar("Please confirm the transaction in MetaMask...", {
          variant: "info",
        });

        const transaction = {
          from: address,
          to: serverAddress,
          value: costHex,
          gas: "0x5208", // 21000 gas limit for simple ETH transfer
        };

        txHash = (await eth.request({
          method: "eth_sendTransaction",
          params: [transaction],
        })) as string;

        enqueueSnackbar(`Payment sent! TX: ${txHash.slice(0, 10)}...`, {
          variant: "success",
        });
      } else {
        enqueueSnackbar(
          "Payment not required on testnet. Creating ownable...",
          {
            variant: "info",
          }
        );
      }

      setIsProcessingPayment(false);
      setIsUploading(true);

      // Step 4: Create zip file
      enqueueSnackbar("Creating ownable package...", { variant: "info" });

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Create ownableData.json
      const imageExtension = imageFile.name.split(".").pop()?.toLowerCase();
      const ownableData: any = {
        PLACEHOLDER1_NAME: name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        PLACEHOLDER1_DESCRIPTION: description || "",
        PLACEHOLDER1_VERSION: "1.0.0",
        PLACEHOLDER1_AUTHORS: address,
        PLACEHOLDER1_KEYWORDS: [],
        templateId: DEFAULT_TEMPLATE_ID,
        PLACEHOLDER4_TYPE: "basic",
        PLACEHOLDER4_DESCRIPTION: description || "",
        PLACEHOLDER4_NAME: name,
        PLACEHOLDER2_IMG: `image.${imageExtension}`,
        PLACEHOLDER2_TITLE: name,
        OWNABLE_THUMBNAIL: `image.${imageExtension}`,
        CREATE_NFT: "true",
        NFT_BLOCKCHAIN: "base",
        generatedAt: new Date().toISOString(),
      };

      // Only include transaction ID if payment was made (not on testnet)
      if (txHash) {
        ownableData.OWNABLE_LTO_TRANSACTION_ID = txHash;
      }

      zip.file("ownableData.json", JSON.stringify([ownableData], null, 2));

      // Add image file
      zip.file(`image.${imageExtension}`, imageFile);

      // Create chain.json
      const chainData = {
        networkId: ltoNetworkId,
        timestamp: Date.now(),
        version: "1.0.0",
      };
      zip.file("chain.json", JSON.stringify(chainData, null, 2));

      // Generate zip as blob
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipArray = new Uint8Array(await zipBlob.arrayBuffer());

      // Step 5: Upload to builder
      enqueueSnackbar("Uploading to builder...", { variant: "info" });

      const uploadOptions: any = {
        templateId: DEFAULT_TEMPLATE_ID,
        name: name,
        sender: address,
      };

      // Only include signedTransaction if payment was made (not on testnet)
      if (txHash) {
        uploadOptions.signedTransaction = txHash;
      }

      const result = await builderService.upload(zipArray, uploadOptions);

      enqueueSnackbar(
        `Ownable uploaded successfully! Request ID: ${result.requestId}`,
        { variant: "success" }
      );

      // Reset form
      setName("");
      setDescription("");
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Upload error:", error);
      setError(error.message || "Upload failed");
      enqueueSnackbar(`Upload failed: ${error.message || "Unknown error"}`, {
        variant: "error",
      });
    } finally {
      setIsProcessingPayment(false);
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading && !isProcessingPayment) {
      setName("");
      setDescription("");
      setImageFile(null);
      setImagePreview(null);
      setError(null);
      setNameError(null);
      setDescriptionError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Ownable</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            label="Name *"
            value={name}
            onChange={handleNameChange}
            fullWidth
            required
            disabled={isUploading || isProcessingPayment}
            helperText={
              nameError ||
              "Only letters and numbers allowed (no spaces, emojis, or special characters)"
            }
            error={!!nameError}
          />

          <TextField
            label="Description"
            value={description}
            onChange={handleDescriptionChange}
            fullWidth
            multiline
            rows={3}
            disabled={isUploading || isProcessingPayment}
            helperText={
              descriptionError ||
              "Letters, numbers, spaces, and basic punctuation only (no emojis)"
            }
            error={!!descriptionError}
          />

          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Image * (GIF, WebP, PNG, JPEG)
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/gif,image/webp,image/png,image/jpeg,image/jpg"
              onChange={handleImageChange}
              disabled={isUploading || isProcessingPayment}
              style={{ width: "100%" }}
            />
            {imagePreview && (
              <Box
                sx={{
                  mt: 2,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "200px",
                    objectFit: "contain",
                  }}
                />
              </Box>
            )}
          </Box>

          {templateCost && !isTestnet && (
            <Alert severity="info">
              Template cost: {formatEther(parseEther(templateCost.eth))} ETH
              ($1.00 USD)
              {address && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Payment will be sent to the builder service wallet
                </Typography>
              )}
            </Alert>
          )}
          {isTestnet && (
            <Alert severity="success">
              Payment not required on testnet. You can create ownables for free!
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={isUploading || isProcessingPayment}
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={
            isUploading || isProcessingPayment || !name.trim() || !imageFile
          }
          startIcon={
            isUploading || isProcessingPayment ? (
              <CircularProgress size={20} />
            ) : null
          }
        >
          {isProcessingPayment
            ? "Processing Payment..."
            : isUploading
            ? "Uploading..."
            : "Create Ownable"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
