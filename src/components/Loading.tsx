import {Backdrop, CircularProgress} from "@mui/material";
import React from "react";

export default function Loading(props: {show: boolean}) {
  return <Backdrop open={props.show} sx={{zIndex: (theme) => theme.zIndex.drawer + 1 }} invisible>
    <CircularProgress color="primary" size={80} />
  </Backdrop>
}
