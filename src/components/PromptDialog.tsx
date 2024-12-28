import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  TextFieldProps,
  IconButton,
  InputAdornment,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useState } from "react";
import { AlertColor } from "@mui/material/Alert/Alert";
import Paste from "@mui/icons-material/ContentPasteOutlined";
import { networkList } from "../utils/data";

interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    address: string,
    fee?: number | null,
    network?: string | null
  ) => void;
  title: string;
  severity?: AlertColor;
  cancel?: string;
  ok?: string;
  TextFieldProps?: TextFieldProps;
  validate?: (value: string) => string;
  fee?: number | null;
  showChainDropdown?: boolean;
  network?: string | null;
  redeemValue?: number | null;
  actionType: "redeem" | "transfer" | "bridge" | "delete";
}

export default function PromptDialog(props: PromptDialogProps) {
  const {
    open,
    onClose,
    onSubmit,
    validate,
    fee,
    showChainDropdown,
    network,
    redeemValue,
    actionType,
  } = props;
  const [address, setAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const getChainLabel = () => {
    switch (network) {
      case "ethereum":
        return "Enter valid Ethereum address";
      case "arbitrum":
        return "Enter valid Arbitrum address";
      default:
        return "Enter valid wallet address";
    }
  };

  const close = () => {
    setError(null);
    setAddress("");
    onClose();
  };

  const submit = () => {
    const validationError = validate && validate(address);
    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit(address, fee, network);
    close();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAddress(text);
      setError(null);
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
    }
  };

  return (
    <Dialog open={open} onClose={close} transitionDuration={0}>
      <DialogTitle>{props.title}</DialogTitle>
      {showChainDropdown && (
        <DialogContent style={{ paddingTop: "5px" }}>
          <FormControl fullWidth>
            <InputLabel id="chain-select-label">Select Chain</InputLabel>
            <Select
              labelId="chain-select-label"
              value={network}
              label="Select Chain"
            >
              {networkList.map((chainItem) => (
                <MenuItem key={chainItem.value} value={chainItem.value}>
                  {chainItem.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
      )}
      <DialogContent
        style={{
          paddingBottom: "0px",
        }}
      >
        {props.TextFieldProps ? (
          <TextField
            {...props.TextFieldProps}
            label={getChainLabel()}
            variant="standard"
            autoFocus
            required
            error={!!error}
            helperText={error}
            value={address}
            onChange={(e) => {
              setError(null);
              setAddress(e.target.value);
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handlePaste} edge="end">
                    <Paste />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        ) : null}
      </DialogContent>

      {actionType === "bridge" && network && (
        <DialogContent>
          <DialogContent
            style={{
              paddingTop: "0px",
              paddingLeft: "0px",
              paddingBottom: "0px",
            }}
          >
            <Typography variant="body2" color="#000">
              NFT Nework:{" "}
              <span style={{ color: "#007FFF" }}>{network.toUpperCase()}</span>
            </Typography>
            <Typography variant="body2" color="#000">
              Bridge Fee: <span style={{ color: "red" }}>{fee} LTO</span>
            </Typography>
          </DialogContent>
        </DialogContent>
      )}

      {actionType === "redeem" && (
        <DialogContent>
          {redeemValue !== null ? (
            <>
              <Typography variant="body1" color="textPrimary">
                You are about to redeem this ownable for:
              </Typography>
              <Typography variant="h6" color="primary">
                {redeemValue} LTO
              </Typography>
            </>
          ) : (
            <Typography variant="body1" color="textSecondary">
              Fetching redeem value...
            </Typography>
          )}
        </DialogContent>
      )}

      <DialogActions>
        <Button onClick={close} color="secondary">
          {props.cancel || "Cancel"}
        </Button>
        <Button onClick={submit} color={props.severity} variant="contained">
          {props.ok || "Ok"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
