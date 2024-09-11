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
} from "@mui/material";
import { useState } from "react";
import { AlertColor } from "@mui/material/Alert/Alert";
import Paste from "@mui/icons-material/ContentPasteOutlined";

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
  fee?: string;
}

export default function PromptDialog(props: PromptDialogProps) {
  const { open, onClose, onSubmit, validate, fee } = props;
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

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
      <DialogContent
        style={{
          paddingBottom: "0px",
        }}
      >
        <TextField
          {...props.TextFieldProps}
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
