import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import {IconButton, SxProps, Theme} from "@mui/material";
import MoreVert from "@mui/icons-material/MoreVert";
import {useState, MouseEvent} from "react";
import {Delete, PrecisionManufacturing, SwapHoriz, Lock} from "@mui/icons-material";
import PromptDialog from "./PromptDialog";
import LTOService from "../services/LTO.service";
import LockDialog from "./LockDialog";

interface OwnableActionsProps {
  sx?: SxProps<Theme>;
  isConsumable: boolean;
  isTransferable: boolean;
  onDelete: () => void;
  onConsume: () => void;
  onTransfer: (address: string) => void;
  onLock: (address: string) => void;
}

export default function OwnableActions(props: OwnableActionsProps) {
  const {onDelete, onConsume, onTransfer, onLock, isConsumable, isTransferable} = props;
  const [anchorEl, setAnchorEl] = useState<null|HTMLElement>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);

  const open = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const close = () => {
    setAnchorEl(null);
  };

  return <>
    <IconButton sx={props.sx} onClick={open}><MoreVert /></IconButton>
    <Menu
      anchorEl={anchorEl}
      open={!!anchorEl}
      onClose={close}
      onClick={close}
      PaperProps={{
        elevation: 0,
        sx: {
          overflow: 'visible',
          filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
          mt: 1.5,
          '&:before': {
            content: '""',
            display: 'block',
            position: 'absolute',
            top: 0,
            right: 14,
            width: 10,
            height: 10,
            bgcolor: 'background.paper',
            transform: 'translateY(-50%) rotate(45deg)',
            zIndex: 0,
          },
        },
      }}
      transformOrigin={{horizontal: 'right', vertical: 'top'}}
      anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
    >
      <MenuItem onClick={() => {close(); setShowLockDialog(true);}}>
        <ListItemIcon><Lock fontSize="small"/></ListItemIcon>
        Bridge for NFT
      </MenuItem>
      <MenuItem disabled={!isConsumable} onClick={() => {close(); onConsume();}}>
        <ListItemIcon><PrecisionManufacturing fontSize="small"/></ListItemIcon>
        Consume
      </MenuItem>
      <MenuItem disabled={!isTransferable} onClick={() => {close(); setShowTransferDialog(true);}}>
        <ListItemIcon><SwapHoriz fontSize="small"/></ListItemIcon>
        Transfer
      </MenuItem>
      <MenuItem onClick={() => {close(); onDelete();}}>
        <ListItemIcon><Delete fontSize="small"/></ListItemIcon>
        Delete
      </MenuItem>
    </Menu>

    <LockDialog
      title = "Are you sure you want to lock the ownable to the bridge"
      open = {showLockDialog}
      onClose = {() => {setShowLockDialog(false)}}
      onSubmit={onLock}
      />

    <PromptDialog
      title="Transfer Ownable"
      open={showTransferDialog}
      onClose={() => setShowTransferDialog(false)}
      onSubmit={onTransfer}
      validate={address => {
        if (!LTOService.isValidAddress(address)) return "Invalid address";
        if (LTOService.address === address) return "Can't transfer to own account"
      }}
      TextFieldProps={{
        label: "Recipient address",
        sx: { width: "380px", maxWidth: "100%" },
      }}
    />
  </>
}
