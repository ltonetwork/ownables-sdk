import {Event} from "@ltonetwork/lto";
import {Card, CardContent} from "@mui/material";
import AntSwitch from "./AntSwitch";
import {useState} from "react";
import If from "./If";

interface ChainViewProps {
  event: Event;
}

enum DataView {
  BASE64,
  JSON
}

export default function EventCard(props: ChainViewProps) {
  const [dataView, setDataView] = useState<DataView>(DataView.BASE64);
  const {event} = props;

  return (
    <Card key={event.hash.base58}>
      <CardContent sx={{fontSize: 12}}>
        <div><strong>Timestamp: </strong>{event.timestamp ? new Date(event.timestamp).toString() : ''}</div>
        <div className="truncate"><strong>Signature: </strong>{event.signature?.base58}</div>
        <div className="truncate"><strong>Signer: </strong>{event.signKey?.publicKey.base58}</div>
        <div style={{marginTop: 10}}><strong>Media type: </strong>{event.mediaType}</div>
        <div>
          <strong>Data: </strong>
          <span style={{marginRight: 5}}>base64</span>
            <AntSwitch
              onChange={(event, checked) => setDataView(checked ? DataView.JSON : DataView.BASE64)}
              sx={{display: "inline-flex"}} />
          <span style={{marginLeft: 5}}>JSON</span>
          <If condition={dataView == DataView.BASE64}>
            <pre className="base64" style={{marginBottom: 0}}>{event.data.base64}</pre>
          </If>
        </div>
      </CardContent>
    </Card>
  )
}
