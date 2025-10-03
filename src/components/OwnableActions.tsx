import { Menu, MenuItem, IconButton, SxProps, Theme } from "@mui/material";
import ListItemIcon from "@mui/material/ListItemIcon";
import MoreVert from "@mui/icons-material/MoreVert";
import { useState, MouseEvent } from "react";
import { Delete, PrecisionManufacturing, SwapHoriz } from "@mui/icons-material";
import PromptDialog from "./PromptDialog";
import { useAccount } from "wagmi"

interface OwnableActionsProps {
  sx?: SxProps<Theme>;
  title: string;
  isConsumable: boolean;
  isTransferable: boolean;
  chain: any;
  onDelete: () => void;
  onConsume: () => void;
  onTransfer: (address: string) => void;
}

export default function OwnableActions(props: OwnableActionsProps) {
  const { onDelete, onConsume, onTransfer, isConsumable, isTransferable } =
    props;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const { address } = useAccount();

  const open = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const close = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton sx={props.sx} onClick={open}>
        <MoreVert />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={close}
        onClick={close}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: "visible",
            filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
            mt: 1.5,
            "&:before": {
              content: '""',
              display: "block",
              position: "absolute",
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: "background.paper",
              transform: "translateY(-50%) rotate(45deg)",
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem
          disabled={!isConsumable}
          onClick={() => {
            close();
            onConsume();
          }}
        >
          <ListItemIcon>
            <PrecisionManufacturing fontSize="small" />
          </ListItemIcon>
          Consume
        </MenuItem>
        <MenuItem
          disabled={!isTransferable}
          onClick={() => {
            close();
            setShowTransferDialog(true);
          }}
        >
          <ListItemIcon>
            <SwapHoriz fontSize="small" />
          </ListItemIcon>
          Transfer
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            onDelete();
          }}
        >
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      <PromptDialog
        title="Transfer Ownable"
        open={showTransferDialog}
        onClose={() => setShowTransferDialog(false)}
        onSubmit={onTransfer}
        validate={(recipient) => {
          if (address === recipient) return "Can't transfer to own account";
          return "";
        }}
        TextFieldProps={{
          label: "Recipient address",
          sx: { width: "380px", maxWidth: "100%" },
        }}
        actionType="transfer"
      />
    </>
  );
}
