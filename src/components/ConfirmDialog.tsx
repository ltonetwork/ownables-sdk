import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from "@mui/material";
import {ReactNode} from "react";
import {AlertColor} from "@mui/material/Alert/Alert";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  severity?: AlertColor,
  cancel?: string;
  ok?: string;
  children: ReactNode;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  const {open, onClose, onConfirm} = props;

  return <Dialog open={open} onClose={onClose} transitionDuration={0}>
    <DialogTitle>{props.title}</DialogTitle>
    <DialogContent>
      <DialogContentText>
        {props.children}
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="secondary">{props.cancel || 'Cancel'}</Button>
      <Button
        onClick={() => {onClose(); onConfirm();}}
        autoFocus
        color={props.severity}
        variant="contained"
      >{props.ok || 'Ok'}</Button>
    </DialogActions>
  </Dialog>
}
