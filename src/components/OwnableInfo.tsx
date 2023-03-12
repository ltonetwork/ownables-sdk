import {Chip, DialogContent, DialogContentText, DialogTitle, IconButton, SxProps, Theme} from "@mui/material";
import {useState} from "react";
import {Fingerprint, InfoOutlined} from "@mui/icons-material";
import {TypedMetadata} from "../interfaces/TypedMetadata";
import Dialog from "@mui/material/Dialog";
import {EventChain} from "@ltonetwork/lto";
import EventCard from "./EventCard";
import shortId from "../utils/shortId";
import Tooltip from "./Tooltip";

interface OwnableInfoProps {
  sx?: SxProps<Theme>;
  chain: EventChain;
  metadata?: TypedMetadata;
}

export default function OwnableInfo(props: OwnableInfoProps) {
  const {chain, metadata} = props;
  const [open, setOpen] = useState(false);

  return <>
    <IconButton sx={props.sx} onClick={() => setOpen(true)}><InfoOutlined /></IconButton>
    <Dialog onClose={() => setOpen(false)} open={open}>
      <DialogTitle component="h3" sx={{ fontSize: 12, pb: 0 }} color="primary">
        <Tooltip title={chain.id}>
          <Chip label={shortId(chain.id)} icon={<Fingerprint />} color="primary" size="small" variant="outlined" />
        </Tooltip>
      </DialogTitle>
      <DialogTitle sx={{ pt: 1, pb: 1 }}>
        {metadata?.name}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14, pb: 2}}>{metadata?.description}</DialogContentText>
        {chain.events.map(event => <EventCard key={event.hash.hex} event={event} />)}
      </DialogContent>
    </Dialog>
  </>
}
