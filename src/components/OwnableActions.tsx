import { Menu, MenuItem, IconButton, SxProps, Theme } from "@mui/material";
import ListItemIcon from "@mui/material/ListItemIcon";
import MoreVert from "@mui/icons-material/MoreVert";
import { useState, MouseEvent, useEffect } from "react";
import { Delete, PrecisionManufacturing, SwapHoriz } from "@mui/icons-material";
import BridgeIcon from "@mui/icons-material/LeakAdd";
import PromptDialog from "./PromptDialog";
import LTOService from "../services/LTO.service";
import { BridgeService } from "../services/Bridge.service";

interface OwnableActionsProps {
  sx?: SxProps<Theme>;
  isConsumable: boolean;
  isTransferable: boolean;
  onDelete: () => void;
  onConsume: () => void;
  onTransfer: (address: string) => void;
  onBridge: (address: string) => void;
}

export default function OwnableActions(props: OwnableActionsProps) {
  const {
    onDelete,
    onConsume,
    onTransfer,
    onBridge,
    isConsumable,
    isTransferable,
  } = props;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showBridgeDialog, setShowBridgeDialog] = useState(false);
  const [bridgeFee, setBridgeFee] = useState<number | null>(null);
  const [chain, setChain] = useState("ethereum");

  const open = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const close = () => {
    setAnchorEl(null);
  };

  const toLto = (amount: number) => {
    const lto_amount = amount / 100000000;
    return lto_amount;
  };

  const handleFee = async () => {
    try {
      const fee = await BridgeService.getTemplateCost("1");

      switch (chain) {
        case "arbitrum":
          setBridgeFee(toLto(fee.arbitrum));
          break;
        default:
          setBridgeFee(toLto(fee.ethereum));
          break;
      }
    } catch (error) {
      console.error("Error fetching fee:", error);
      setBridgeFee(null);
    }
  };

  const openBridgeDialog = async () => {
    await handleFee();
    setShowBridgeDialog(true);
  };

  useEffect(() => {
    handleFee();
  }, [chain]);

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
          disabled={!isTransferable}
          onClick={() => {
            close();
            openBridgeDialog();
          }}
        >
          <ListItemIcon>
            <BridgeIcon fontSize="small" />
          </ListItemIcon>
          Send to bridge
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
        validate={(address) => {
          if (!LTOService.isValidAddress(address)) return "Invalid address";
          if (LTOService.address === address)
            return "Can't transfer to own account";
        }}
        TextFieldProps={{
          label: "Recipient address",
          sx: { width: "380px", maxWidth: "100%" },
        }}
        onChainChange={setChain}
      />

      <PromptDialog
        title="Bridge Ownable"
        open={showBridgeDialog}
        onClose={() => setShowBridgeDialog(false)}
        onSubmit={onBridge}
        // validate={(address) => {
        //   if (!LTOService.isValidAddress(address)) return "Invalid address";
        //   if (LTOService.address === address)
        //     return "Can't transfer to own account";
        // }}
        TextFieldProps={{
          label: chain,
          sx: { width: "380px", maxWidth: "100%" },
        }}
        fee={bridgeFee}
        showChainDropdown={true}
        chain={chain}
        onChainChange={setChain}
      />
    </>
  );
}
