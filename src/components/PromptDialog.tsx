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
import { chainList } from "../utils/data/chainList";

interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: string) => void;
  title: string;
  severity?: AlertColor;
  cancel?: string;
  ok?: string;
  TextFieldProps?: TextFieldProps;
  validate?: (value: string) => string | undefined;
  fee?: number | null;
  showChainDropdown?: boolean;
  chain?: string;
  onChainChange: (chain: string) => void;
}

export default function PromptDialog(props: PromptDialogProps) {
  const {
    open,
    onClose,
    onSubmit,
    validate,
    fee,
    showChainDropdown,
    chain,
    onChainChange,
  } = props;
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const getChainLabel = () => {
    switch (chain) {
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
    setValue("");

    onClose();
  };

  const submit = () => {
    const validationError = validate && validate(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit(value);
    close();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue(text);
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
              value={chain}
              label="Select Chain"
              onChange={(e) => onChainChange(e.target.value)}
            >
              {chainList.map((chainItem) => (
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
        <TextField
          {...props.TextFieldProps}
          label={getChainLabel()}
          variant="standard"
          autoFocus
          required
          error={!!error}
          helperText={error}
          value={value}
          onChange={(e) => {
            setError(null);
            setValue(e.target.value);
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
      </DialogContent>
      {fee && (
        <DialogContent>
          <DialogContent
            style={{
              paddingTop: "0px",
              paddingLeft: "0px",
              paddingBottom: "0px",
            }}
          >
            <Typography variant="body2" color="#000">
              Bridge Fee: <span style={{ color: "red" }}>{fee} LTO</span>
            </Typography>
          </DialogContent>
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
