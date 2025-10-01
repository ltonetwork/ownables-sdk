import React, { useEffect, useState, useCallback } from "react";
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
  Skeleton,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { RelayService } from "../services/Relay.service";
import axios from "axios";
import { EventChain } from "eqty-core";
import { enqueueSnackbar } from "notistack";
import LocalStorageService from "../services/LocalStorage.service";
import placeholderImage from "../assets/cube.png";

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

const SkeletonMessageItem = () => (
  <ListItem
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      mb: 2,
      borderBottom: "1px solid #ddd",
      pb: 2,
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
      <Skeleton
        variant="rectangular"
        width={35}
        height={35}
        sx={{ borderRadius: "10%" }}
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="80%" height={16} />
        <Skeleton variant="text" width="60%" height={14} />
      </Box>
    </Box>
    <Skeleton variant="text" width="70%" height={14} sx={{ mt: 1 }} />
    <Skeleton
      variant="rectangular"
      width={80}
      height={28}
      sx={{ mt: 1, borderRadius: 1 }}
    />
  </ListItem>
);

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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  const fetchBuilderAddress = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_OBUILDER}/api/v1/GetServerInfo`,
        {
          headers: {
            "X-API-Key": `${process.env.REACT_APP_OBUILDER_API_SECRET_KEY}`,
            Accept: "*/*",
          },
        }
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

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const limit = itemsPerPage;
      const relayData = await RelayService.list(offset, limit);

      if (relayData && Array.isArray(relayData.messages)) {
        setTotalCount(relayData.total);
        setMessages(relayData.messages);
      } else {
        setTotalCount(0);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      setTotalCount(0);
      setMessages([]);
    }
    setLoading(false);
  }, [currentPage, itemsPerPage]);

  const fetchImportedHashes = async () => {
    try {
      const pkgs = LocalStorageService.get("packages") || [];
      const hashes = pkgs.map((msg: any) => {
        return msg.uniqueMessageHash;
      });
      setImportedHashes(new Set(hashes));
    } catch (error) {
      console.error("Failed to fetch imported hashes:", error);
    }
  };

  const handleImportMessage = async (hash: string) => {
    try {
      const importedPackage = await RelayService.readMessage(hash);

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
  }, [open, fetchMessages]);

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
          <List>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonMessageItem key={i} />
            ))}
          </List>
        ) : (
          <List>
            {messages.map((msg, index) =>
              msg.version === 0 ? (
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
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      gap: 1,
                    }}
                  >
                    {" "}
                    <Box
                      sx={{
                        width: 35,
                        height: 35,
                        borderRadius: "10%",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={placeholderImage}
                        alt="Thumbnail"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </Box>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          sx={{ fontSize: "0.6rem", fontWeight: "bold" }}
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
                          sx={{ fontSize: "0.6rem", color: "text.secondary" }}
                        >
                          Size: {(msg?.size / 1024 / 1024 || 0).toFixed(2)} MB
                        </Typography>
                      }
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, fontSize: "0.55rem" }}
                  >
                    <span style={{ fontWeight: 800 }}> Date:</span>{" "}
                    {new Date(msg?.timestamp || 0).toLocaleString()}
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <Button
                      variant="contained"
                      size="small"
                      sx={{
                        fontSize: "0.625rem",
                        padding: "3px 6px",
                        minWidth: "unset",
                        lineHeight: 1.3,
                      }}
                      onClick={() => handleImportMessage(msg?.hash)}
                    >
                      Import Message
                    </Button>
                    {!importedHashes.has(msg?.hash) && (
                      <Badge color="success" variant="dot" sx={{ ml: 2 }} />
                    )}
                  </Box>
                </ListItem>
              ) : (
                //version 2 message support
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
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      gap: 1,
                    }}
                  >
                    {(msg?.meta?.thumbnail && (
                      <Box
                        sx={{
                          width: 35,
                          height: 35,
                          borderRadius: "10%",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={msg.meta.thumbnail}
                          alt="Thumbnail"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </Box>
                    )) || (
                      <Box
                        sx={{
                          width: 35,
                          height: 35,
                          borderRadius: "10%",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={placeholderImage}
                          alt="Thumbnail"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </Box>
                    )}

                    <Box>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.7rem", fontWeight: "bold" }}
                      >
                        {msg?.meta?.title
                          ? msg.meta.title.length > 16
                            ? msg.meta.title.slice(0, 16) + "..."
                            : msg.meta.title
                          : "Unknown"}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.6rem", fontWeight: "bold" }}
                      >
                        Sender:{" "}
                        {msg?.sender === builderAddress
                          ? "Obuilder"
                          : msg?.sender || "Unknown"}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.6rem", color: "text.secondary" }}
                      >
                        Size: {(msg?.size / 1024 / 1024 || 0).toFixed(2)} MB
                      </Typography>
                    </Box>
                  </Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, fontSize: "0.55rem" }}
                  >
                    <span style={{ fontWeight: 800 }}> Date:</span>{" "}
                    {new Date(msg?.timestamp || 0).toLocaleString()}
                  </Typography>

                  <Box display="flex" alignItems="center" mt={1}>
                    <Button
                      variant="contained"
                      size="small"
                      sx={{
                        fontSize: "0.625rem",
                        padding: "3px 6px",
                        minWidth: "unset",
                        lineHeight: 1.3,
                      }}
                      onClick={() => handleImportMessage(msg?.hash)}
                    >
                      Import Message
                    </Button>
                    {!importedHashes.has(msg?.hash) && (
                      <Badge color="success" variant="dot" sx={{ ml: 2 }} />
                    )}
                  </Box>
                </ListItem>
              )
            )}
          </List>
        )}
        {messages.length > 0 && (
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mt={2}
          >
            <Button
              variant="outlined"
              size="small"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <Typography variant="body2">
              Page {currentPage} of {Math.ceil(totalCount / itemsPerPage)}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                setCurrentPage((prev) =>
                  prev < Math.ceil(totalCount / itemsPerPage) ? prev + 1 : prev
                )
              }
              disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
            >
              Next
            </Button>
          </Box>
        )}
        <Box display="flex" justifyContent="center" mt={1}>
          <Button
            variant="text"
            size="small"
            onClick={() => {
              setItemsPerPage((prev) => (prev === 50 ? 100 : 50));
              setCurrentPage(1);
            }}
          >
            {itemsPerPage === 50 ? "Show 100 per page" : "Show 50 per page"}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};
