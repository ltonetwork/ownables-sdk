import React, { useEffect, useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Button,
  Badge,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { RelayService } from "../services/Relay.service";
import axios from "axios";
import { EventChain } from "@ltonetwork/lto";
import { enqueueSnackbar } from "notistack";
import LocalStorageService from "../services/LocalStorage.service";

interface ViewMessagesBarProps {
  open: boolean;
  onClose: () => void;
  messagesCount: number;
  setOwnables: React.Dispatch<
    React.SetStateAction<
      Array<{ chain: EventChain; package: string; uniqueMessageHash?: string }>
    >
  >;
}

export const network = process.env.REACT_APP_LTO_NETWORK_ID;

export const ViewMessagesBar: React.FC<ViewMessagesBarProps> = ({
  open,
  onClose,
  messagesCount,
  setOwnables,
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [builderAddress, setBuilderAddress] = useState<string | null>(null);
  const [importedHashes, setImportedHashes] = useState<Set<string>>(new Set());

  const fetchBuilderAddress = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_OBUILDER}/api/v1/GetServerInfo`
      );
      const serverAddress =
        network === "T"
          ? response.data.serverLtoWalletAddress_T
          : response.data.serverLtoWalletAddress_L;
      setBuilderAddress(serverAddress);
    } catch (error) {
      console.error("Failed to fetch builder address:", error);
      setBuilderAddress(null);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const relayData = await RelayService.listRelayMetaData();
      if (relayData && Array.isArray(relayData)) {
        setMessages(relayData);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    }
    setLoading(false);
  };

  const fetchImportedHashes = async () => {
    try {
      const hashes = await LocalStorageService.get("messageHashes");
      setImportedHashes(new Set(hashes));
    } catch (error) {
      console.error("Failed to fetch imported hashes:", error);
    }
  };

  const handleImportMessage = async (hash: string) => {
    try {
      const importedPackage = await RelayService.readSingleMessage(hash);

      if (importedPackage) {
        const chain = importedPackage.chain ? importedPackage.chain : null;

        if (chain) {
          setOwnables((prevOwnables) => [
            ...prevOwnables,
            {
              chain,
              package: importedPackage.cid,
              uniqueMessageHash: importedPackage.uniqueMessageHash,
            },
          ]);

          // Update imported hashes
          setImportedHashes((prev) => new Set(prev).add(hash));
          const messageCount = await LocalStorageService.get("messageCount");
          const newCount = Math.max(0, parseInt(messageCount || "0", 10) - 1);
          await LocalStorageService.set("messageCount", newCount);
          enqueueSnackbar(`Ownable imported successfully!`, {
            variant: "success",
          });
        } else {
          enqueueSnackbar(`Failed to parse import`, {
            variant: "error",
          });
        }
      } else {
        enqueueSnackbar(`Ownable already imported!`, {
          variant: "error",
        });
      }
    } catch (error) {
      console.error("Error importing message:", error);
      enqueueSnackbar(`Failed to import ownable`, {
        variant: "error",
      });
    }
  };

  useEffect(() => {
    fetchBuilderAddress();
  }, []);

  useEffect(() => {
    if (open) {
      fetchMessages();
      fetchImportedHashes();
    }
  }, [open]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 350, p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            Messages
          </Typography>
          <IconButton onClick={onClose}>
            <ArrowBack />
          </IconButton>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body1">
            {messagesCount > 0
              ? `You have ${messagesCount} unread messages.`
              : "No new messages"}
          </Typography>
        </Box>

        {loading ? (
          <Typography variant="body2" sx={{ mt: 2 }}>
            Loading messages...
          </Typography>
        ) : (
          <List>
            {messages.map((msg, index) => (
              <ListItem
                key={index}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  mb: 2,
                  borderBottom: "1px solid #ddd",
                  pb: 2,
                }}
              >
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      sx={{ fontSize: "0.875rem", fontWeight: "bold" }}
                    >
                      Sender:{" "}
                      {msg?.sender === builderAddress
                        ? "Obuilder"
                        : msg?.sender || "Unknown"}
                    </Typography>
                  }
                  secondary={
                    <Typography
                      variant="body2"
                      sx={{ fontSize: "0.8rem", color: "text.secondary" }}
                    >
                      Size: {(msg?.size / 1024 / 1024 || 0).toFixed(2)} MB
                    </Typography>
                  }
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Time: {new Date(msg?.timestamp || 0).toLocaleString()}
                </Typography>
                <Box display="flex" alignItems="center" mt={1}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleImportMessage(msg?.hash)}
                  >
                    Import Message
                  </Button>
                  {!importedHashes.has(msg?.hash) && (
                    <Badge color="success" variant="dot" sx={{ ml: 2 }} />
                  )}
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
};
