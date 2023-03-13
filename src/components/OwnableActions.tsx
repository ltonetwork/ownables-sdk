import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import {IconButton, SxProps, Theme} from "@mui/material";
import MoreVert from "@mui/icons-material/MoreVert";
import {useState, MouseEvent} from "react";
import {Delete, PrecisionManufacturing, SwapHoriz} from "@mui/icons-material";

interface OwnableActionsProps {
  sx?: SxProps<Theme>;
  onDelete: () => void;
}

export default function OwnableActions(props: OwnableActionsProps) {
  const [anchorEl, setAnchorEl] = useState<null|HTMLElement>(null);
  const {onDelete} = props;

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
      <MenuItem onClick={close}>
        <ListItemIcon><PrecisionManufacturing fontSize="small"/></ListItemIcon>
        Consume
      </MenuItem>
      <MenuItem onClick={close}>
        <ListItemIcon><SwapHoriz fontSize="small"/></ListItemIcon>
        Transfer
      </MenuItem>
      <MenuItem onClick={() => {close(); onDelete();}}>
        <ListItemIcon><Delete fontSize="small"/></ListItemIcon>
        Delete
      </MenuItem>
    </Menu>
  </>
}
