import {Drawer} from "@mui/material";
import {ReactNode} from "react";

interface HelpDrawerProps {
  open: boolean;
  children: ReactNode;
}

export default function HelpDrawer(props: HelpDrawerProps) {
  return <Drawer
    anchor="bottom"
    open={props.open}
    hideBackdrop
    variant="persistent"
    PaperProps={{
      sx: theme => ({p: 2, textAlign: 'center', backgroundColor: theme.palette.primary.dark, color: theme.palette.primary.contrastText}),
    }}
  >
    { props.children }
  </Drawer>
}
