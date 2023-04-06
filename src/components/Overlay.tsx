import {Box, BoxProps} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";
import {forwardRef, Ref, useEffect, useState} from "react";

interface OverlayProps extends BoxProps {
  disabled?: boolean|Promise<boolean>;
  zIndex?: number;
}

function Overlay(props: OverlayProps, ref: Ref<any>) {
  const {children, sx, onClick, disabled, zIndex , ...boxProps} = props;
  const [isEnabled, setIsEnabled] = useState(disabled === undefined);

  useEffect(() => {
    if (disabled instanceof Promise) {
      disabled.then(v => setIsEnabled(!v));
    } else {
      setIsEnabled(!disabled)
    }
  }, [disabled]);

  return <Box
    {...boxProps}
    ref={ref}
    onClick={isEnabled ? onClick : undefined}
    sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      zIndex: zIndex ?? 5,
      backgroundColor: isEnabled ? '' : 'rgba(255, 255, 255, 0.8)',
      cursor: onClick && isEnabled ? 'pointer' : '',
      ...sx,
  }}
  >
    {children}
  </Box>
}

export default forwardRef(Overlay);

export function OverlayBanner(props: {children: React.ReactNode}) {
  return <>
    <Grid container justifyContent="center" alignItems="center" height="100%" width="100%" overflow="hidden" padding={0} margin={0}>
      <Grid width="100%" padding={0} textAlign="center">
        <Box sx={theme => ({
          backgroundColor: theme.palette.primary.dark,
          color: theme.palette.primary.contrastText,
          pt: 1,
          pb: 1,
          width: "120%",
          marginLeft: "-10%",
          fontSize: 28,
          transform: "rotate(-10deg)",
          cursor: 'default',
          userSelect: 'none',
        })}>
          {props.children}
        </Box>
      </Grid>
    </Grid>
  </>
}
