import { Event } from "eqty-core";
import { Box, Card, CardContent, Link, Paper, styled } from "@mui/material";
import AntSwitch from "./AntSwitch";
import { useState } from "react";
import If from "./If";
import ReactJson from "react-json-view";
import { Cancel, CheckCircle } from "@mui/icons-material";
import shortId from "../utils/shortId"

interface EventCardProps {
  event: Event;
  anchorTx: string | undefined;
  verified: boolean;
  isFirst: boolean;
}

enum DataView {
  BASE64,
  JSON,
}

const CardTopLabel = styled(Paper)(() => ({
  padding: "8px 16px 4px 8px",
  fontSize: 12,
  width: "calc(45% - 58px)",
  alignSelf: "flex-end",
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
}));

const CardBottomLabel = styled(Paper)(() => ({
  padding: "4px 8px 8px 16px",
  fontSize: 12,
  width: "calc(45% - 58px)",
  alignSelf: "flex-start",
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  boxShadow:
    "0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 2px 0px rgb(0 0 0 / 12%)",
}));

const cardStyle = {
  borderTopRightRadius: 0,
  borderBottomLeftRadius: 0,
  boxShadow:
    "0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 2px 3px 0px rgb(0 0 0 / 12%)",
  marginBottom: { xs: 3, md: 0 },
};

export default function EventCard(props: EventCardProps) {
  const [dataView, setDataView] = useState<DataView>(
    props.event.mediaType === "application/json"
      ? DataView.JSON
      : DataView.BASE64
  );
  const { event, anchorTx, verified } = props;

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <If condition={!props.isFirst}>
        <CardTopLabel sx={{ display: { xs: "none", md: "block" } }}>
          <div className="truncate">
            <strong>Previous: </strong> {shortId(event.previous?.hex ?? '', 30)}
          </div>
        </CardTopLabel>
      </If>
      <Card key={event.hash.base58} sx={cardStyle}>
        <CardContent sx={{ fontSize: 12, pb: "12px !important" }}>
          <div>
            <strong>Timestamp: </strong>
            {event.timestamp ? new Date(event.timestamp).toString() : ""}
          </div>
          <div className="truncate"><strong>Signed by:</strong> {event.signerAddress ?? ""}</div>
          <div className="truncate"><strong>Signature:</strong> {event.signature?.hex ?? ""}</div>
          <If condition={anchorTx !== null}>
            <div style={{ marginTop: 10 }}>
              <strong>Anchor tx: </strong>
              <Link
                href={
                  process.env.REACT_APP_LTO_EXPLORER_URL +
                  "/transaction/" +
                  anchorTx
                }
              >
                {anchorTx}
              </Link>
              <If condition={verified}>
                <CheckCircle
                  fontSize="small"
                  sx={{ verticalAlign: -5, ml: 1 }}
                  color="success"
                />
              </If>
              <If condition={!verified}>
                <Cancel
                  fontSize="small"
                  sx={{ verticalAlign: -5, ml: 1 }}
                  color="error"
                />
              </If>
            </div>
          </If>
          <div style={{ marginTop: 10 }}><strong>Media type:</strong> {event.mediaType}</div>
          <div>
            <strong>Data: </strong>
            <span style={{ marginRight: 5 }}>base64</span>
            <AntSwitch
              disabled={event.mediaType !== "application/json"}
              checked={dataView === DataView.JSON}
              onChange={(event, checked) =>
                setDataView(checked ? DataView.JSON : DataView.BASE64)
              }
              sx={{ display: "inline-flex" }}
            />
            <span style={{ marginLeft: 5 }}>JSON</span>
            <If condition={dataView === DataView.BASE64}>
              <pre className="base64" style={{ marginBottom: 0 }}>
                {event.data.base64}
              </pre>
            </If>
            <If condition={dataView === DataView.JSON}>
              <ReactJson
                style={{ marginTop: 10 }}
                src={event.parsedData ? event.parsedData : event.data}
                enableClipboard={false}
              />
            </If>
          </div>
          <Box
            component="div"
            sx={{ display: { xs: "block", md: "none" }, pt: 2 }}
            className="truncate"
          >
            <strong>Hash:</strong> {shortId(event.hash.hex, 30)}
          </Box>
        </CardContent>
      </Card>
      <CardBottomLabel sx={{ display: { xs: "none", md: "block" } }}>
        <div className="truncate">
          <strong>Hash:</strong> {shortId(event.hash.hex, 30)}
        </div>
      </CardBottomLabel>
    </Box>
  );
}
