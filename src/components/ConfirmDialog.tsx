import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from "@mui/material";
import {ReactNode} from "react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  cancel?: string;
  ok?: string;
  children: ReactNode;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  const {open, onClose, onConfirm} = props;

  return <Dialog open={open} onClose={onClose}>
    <DialogTitle>{props.title}</DialogTitle>
    <DialogContent>
      <DialogContentText>
        {props.children}
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>{props.cancel || 'Cancel'}</Button>
      <Button onClick={onConfirm} autoFocus>{props.ok || 'Ok'}</Button>
    </DialogActions>
  </Dialog>
}
