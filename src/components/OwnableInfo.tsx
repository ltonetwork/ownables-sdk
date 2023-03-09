import {IconButton, SxProps, Theme} from "@mui/material";
import {useState} from "react";
import {InfoOutlined} from "@mui/icons-material";

interface OwnableInfoProps {
  sx?: SxProps<Theme>;
}

export default function OwnableInfo(props: OwnableInfoProps) {
  const [open, setOpen] = useState(false);

  return <>
    <IconButton sx={props.sx} onClick={() => setOpen(true)}><InfoOutlined /></IconButton>
  </>
}
