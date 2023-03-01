import LTOService from "../services/LTO.service";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Dialog,
  Hidden,
  IconButton,
  TextField
} from "@mui/material";
import bgImage from '../assets/login-bg.jpg';
import {useEffect, useState} from "react";
import If from "./If";
import Grid from '@mui/material/Unstable_Grid2';
import {ArrowBack} from "@mui/icons-material";
import PasswordField from "./PasswordField";

const cardStyle = {
  width: 500,
  maxWidth: 'calc(100vw - 64px)',
};

function CreateAccount(props: {next: () => void; onImport: () => void}) {
  const create = () => {
    LTOService.createAccount();
    props.next();
  }

  return <Card style={cardStyle}>
    <CardMedia sx={{ height: 200 }} image={bgImage} />
    <CardContent style={{textAlign: "center"}}>
      <h1 style={{marginTop: 6, marginBottom: 0}}>Ownable SDK Wallet</h1>
      <Hidden smDown><h2 style={{fontWeight: 300, marginBottom: 0}}>Let’s start with setting up an account</h2></Hidden>
    </CardContent>
    <CardActions style={{paddingBottom: 14}}>
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={2}>
          <Grid xs={12} sm={6}><Button variant="contained" fullWidth onClick={create}>Create account</Button></Grid>
          <Grid xs={12} sm={6}><Button variant="text" fullWidth onClick={props.onImport}>Import from seed</Button></Grid>
        </Grid>
      </Box>
    </CardActions>
  </Card>
}

function ImportAccount(props: {next: () => void, back: () => void}) {
  const [seed, setSeed] = useState('');

  const create = () => {
    LTOService.importAccount(seed);
    props.next();
  }

  return <Card style={cardStyle}>
    <CardMedia sx={{ height: 200 }} image={bgImage}>
      <IconButton onClick={props.back}><ArrowBack style={{color: "#fff"}} /></IconButton>
    </CardMedia>
    <CardContent style={{textAlign: "center"}}>
      <TextField label="Seed phrase"
                 variant="standard"
                 multiline
                 fullWidth
                 autoFocus
                 value={seed}
                 onChange={(e) => setSeed(e.target.value)}/>
    </CardContent>
    <CardActions style={{paddingBottom: 14, justifyContent: "right"}}>
      <Button variant="text" onClick={create}>Import</Button>
    </CardActions>
  </Card>
}

function SetPassword(props: {next: () => void}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const store = () => {
    if (password === '') {
      setError(true);
      return;
    }

    LTOService.storeAccount('default', password);
    props.next();
  }

  useEffect(() => setError(false), [password]);

  return <Card style={cardStyle}>
    <CardMedia sx={{ height: 200 }} image={bgImage} />
    <CardContent style={{textAlign: "center"}}>
      <h2 style={{fontWeight: 300}}>Enter a password for your account</h2>
      <PasswordField label="Password"
                     variant="standard"
                     error={error}
                     fullWidth
                     autoFocus
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}/>
    </CardContent>
    <CardActions style={{paddingBottom: 14, justifyContent: "right"}}>
      <Button variant="text" onClick={store}>Continue</Button>
    </CardActions>
  </Card>
}

function UnlockAccount(props: {next: () => void}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const unlock = () => {
    try {
      LTOService.unlock(password);
      props.next();
    } catch {
      setError(true);
    }
  }
  useEffect(() => setError(false), [password]);

  return <Card style={cardStyle}>
    <CardMedia sx={{ height: 200 }} image={bgImage} />
    <CardContent style={{textAlign: "center"}}>
      <h2 style={{fontWeight: 300}}>Welcome back</h2>
      <PasswordField label="Password"
                     variant="standard"
                     fullWidth
                     autoFocus
                     error={error}
                     helperText={error ? 'Incorrect password' : ''}
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}/>
    </CardContent>
    <CardActions style={{paddingBottom: 14, justifyContent: "right"}}>
      <Button variant="text" onClick={unlock}>Continue</Button>
    </CardActions>
  </Card>
}

enum Step {
  'create',
  'import',
  'store',
  'unlock'
}

interface LoginDialogProps {
  open: boolean;
  onLogin: () => void;
}

export default function LoginDialog(props: LoginDialogProps) {
  const {open, onLogin} = props;
  const [step, setStep] = useState<Step>(!LTOService.accountExists() ? Step.create : Step.unlock);

  return <Dialog open={open}>
    <If condition={step === Step.create}><CreateAccount next={() => setStep(Step.store)} onImport={() => setStep(Step.import)} /></If>
    <If condition={step === Step.import}><ImportAccount next={() => setStep(Step.store)} back={() => setStep(Step.create)} /></If>
    <If condition={step === Step.store}><SetPassword next={onLogin} /></If>
    <If condition={step === Step.unlock}><UnlockAccount next={onLogin} /></If>
  </Dialog>
}
