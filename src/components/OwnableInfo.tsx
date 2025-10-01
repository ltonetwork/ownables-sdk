import {
  Chip,
  DialogContent,
  DialogTitle,
  IconButton,
  SxProps,
  Theme,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Fingerprint, InfoOutlined } from "@mui/icons-material";
import { TypedMetadata } from "../interfaces/TypedOwnableInfo";
import Dialog from "@mui/material/Dialog";
import { EventChain } from "eqty-core";
import EventCard from "./EventCard";
import shortId from "../utils/shortId";
import Tooltip from "./Tooltip";
import backgroundImage from "../assets/background.svg";
import If from "./If";
import EventChainService from "../services/EventChain.service";
import useInterval from "../utils/useInterval";

interface OwnableInfoProps {
  sx?: SxProps<Theme>;
  chain: EventChain;
  metadata?: TypedMetadata;
}

const style = {
  backgroundImage: `url(${backgroundImage})`,
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  backgroundSize: "cover",
};

export default function OwnableInfo(props: OwnableInfoProps) {
  const { chain, metadata } = props;
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [anchors, setAnchors] = useState<
    Array<{ tx: string | undefined; verified: boolean } | null>
  >([]);

  const verify = (chain: EventChain, open: boolean) => {
    if (!open) return;

    EventChainService.verify(chain).then(({ verified, anchors, map }) => {
      setVerified(verified);
      setAnchors(
        chain.anchorMap.map(({ key, value }) => ({
          tx: anchors[key.hex],
          verified: map[key.hex] === value.hex,
        }))
      );
    });
  };

  useEffect(() => verify(chain, open), [chain, open]);
  useInterval(() => verify(chain, open), 5 * 1000);

  return (
    <>
      <IconButton sx={props.sx} onClick={() => setOpen(true)}>
        <InfoOutlined />
      </IconButton>
      <Dialog
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="lg"
        open={open}
        PaperProps={{ sx: style }}
      >
        <DialogTitle
          component="div"
          sx={{ fontSize: 12, pb: 0 }}
          color="primary"
        >
          <Tooltip title={chain.id}>
            <Chip
              label={shortId(chain.id)}
              icon={<Fingerprint />}
              color="primary"
              size="small"
              variant="outlined"
            />
          </Tooltip>
          <If condition={verified}>
            <Chip
              label="Anchors verfied"
              color="success"
              size="small"
              sx={{ ml: 1 }}
            />
          </If>
        </DialogTitle>
        <DialogTitle sx={{ pt: 1, pb: 1 }}>{metadata?.name}</DialogTitle>
        <DialogTitle
          component="h3"
          sx={(theme) => ({
            fontSize: 14,
            pt: 0,
            pb: 1.5,
            color: theme.palette.text.secondary,
          })}
        >
          {metadata?.description}
        </DialogTitle>
        <DialogContent>
          <If condition={chain.events.length === 0}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              This is a static ownable. It does not contain any events.
            </Typography>
          </If>
          {chain.events.map((event, i) => (
            <EventCard
              key={event.timestamp}
              event={event}
              anchorTx={anchors[i]?.tx}
              verified={!!anchors[i]?.verified}
              isFirst={i === 0}
            />
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
