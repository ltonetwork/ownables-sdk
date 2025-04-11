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
} from "@mui/material";
import { useState } from "react";
import { AlertColor } from "@mui/material/Alert/Alert";
import Paste from "@mui/icons-material/ContentPasteOutlined";

interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (address: string, fee?: number | null) => void;
  title: string;
  severity?: AlertColor;
  cancel?: string;
  ok?: string;
  TextFieldProps?: TextFieldProps;
  validate?: (value: string) => string;
  fee?: number | null;
  network?: string | null;
  actionType: "transfer" | "delete";
}

export default function PromptDialog(props: PromptDialogProps) {
  const { open, onClose, onSubmit, validate, fee } = props;
  const [address, setAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

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

    onSubmit(address, fee);
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
      <DialogContent
        style={{
          paddingBottom: "0px",
        }}
      >
        {props.TextFieldProps ? (
          <TextField
            {...props.TextFieldProps}
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
