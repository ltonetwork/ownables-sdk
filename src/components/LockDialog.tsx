import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    TextFieldProps
  } from "@mui/material";
  import {useState} from "react";
  import {AlertColor} from "@mui/material/Alert/Alert";
  
  interface LockDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (input: string) => void;
    title: string;
    severity?: AlertColor,
    cancel?: string;
    ok?: string;
    TextFieldProps?: TextFieldProps;
    validate?: (value: string) => string|undefined;
  }
  
  export default function PromptDialog(props: LockDialogProps) {
    const {open, onClose, onSubmit, validate} = props;
    const [value, setValue] = useState<string>('');
    const [error, setError] = useState<string|null>(null);
  
    const close = () => {
      setError(null);
      setValue('');
  
      onClose();
    }
  
    const submit = () => {
      const validationError = validate && validate(value);
      if (validationError) {
        setError(validationError);
        return;
      }
  
      onSubmit(value);
      close();
    }
  
    return <Dialog open={open} onClose={close} transitionDuration={0}>
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <TextField
          {...props.TextFieldProps}
          variant='standard'
          autoFocus
          required
          error={!!error}
          helperText={error}
          value={value}
          onChange={e => {
            setError(null);
            setValue(e.target.value);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close} color="secondary">{props.cancel || 'Cancel'}</Button>
        <Button onClick={submit} color={props.severity} variant="contained">{props.ok || 'Ok'}</Button>
      </DialogActions>
    </Dialog>
  }
  