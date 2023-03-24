import {Box, styled} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";

const Overlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  zIndex: 5,
});

export default Overlay;

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
