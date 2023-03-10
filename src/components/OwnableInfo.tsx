import {DialogContent, DialogContentText, DialogTitle, IconButton, SxProps, Theme} from "@mui/material";
import {useState} from "react";
import {InfoOutlined} from "@mui/icons-material";
import {TypedMetadata} from "../interfaces/TypedMetadata";
import Dialog from "@mui/material/Dialog";

interface OwnableInfoProps {
  sx?: SxProps<Theme>;
  id: string;
  metadata?: TypedMetadata;
}

export default function OwnableInfo(props: OwnableInfoProps) {
  const {id, metadata} = props;
  const canOpen = !!props.metadata;
  const [open, setOpen] = useState(false);

  return <>
    <IconButton sx={props.sx} onClick={() => setOpen(canOpen)}><InfoOutlined /></IconButton>
    <Dialog onClose={() => setOpen(false)} open={open}>
      <DialogTitle>{metadata?.name}</DialogTitle>
      <DialogContent>
        <DialogContentText id={`${id}-info`}>
          {metadata?.description}
        </DialogContentText>
      </DialogContent>
    </Dialog>
  </>
}
