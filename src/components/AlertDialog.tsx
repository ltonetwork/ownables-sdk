import {
  Alert,
  AlertTitle, Box,
  Button,
  Dialog,
  DialogActions,
} from "@mui/material";
import {ReactNode} from "react";
import {AlertColor} from "@mui/material/Alert/Alert";

interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  severity?: AlertColor,
  title?: string;
  children: ReactNode;
}

export default function AlertDialog(props: AlertDialogProps) {
  const {open, onClose, severity} = props;

  return <Dialog open={open} onClose={onClose} transitionDuration={0}>
    <Alert variant="outlined" severity={severity || 'info'}>
      <AlertTitle>{props.title}</AlertTitle>
      <Box sx={{pr: 3}}>{ props.children }</Box>
      <DialogActions sx={{pb: 0}}>
        <Button variant="text" size="small" onClick={onClose}>Ok</Button>
      </DialogActions>
    </Alert>
  </Dialog>
}
