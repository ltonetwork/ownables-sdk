import {Backdrop, CircularProgress} from "@mui/material";
import React from "react";

export default function Loading(props: {show: boolean}) {
  return <Backdrop open={props.show} sx={{zIndex: (theme) => theme.zIndex.modal + 100 }} invisible>
    <CircularProgress color="primary" size={80} />
  </Backdrop>
}
