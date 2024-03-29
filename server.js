// server.js
"use strict";

import express from "express";
import cors from "cors";
import compression from "compression";
import multer from "multer";
import azure from "azure-storage";
import {
  addPrivateRoomParticipants,
  addPublicRoomParticipants,
  removePrivateRoomParticipants,
  removePublicRoomParticipants,
} from "./store/roomStore.js";
import { Server as socketIO } from "socket.io";
import { createRoom, createRoomId } from "./api/createRoom.js";
import { authenticateRoom, authenticateRoomByLink } from "./api/joinRoom.js";
import config from "./config.js";
import { configDotenv } from "dotenv";
import moment from "moment";

const app = express();
configDotenv();

const activeSockets = [];

app.use(cors(config.server.cors));
app.use(compression());
app.use(express.json());
app.use(express.static("public"));

const server = app.listen(config.server.listen.port, () => {
  console.log("App Started at PORT:" + config.server.listen.port);
});

const io = new socketIO(server, {
  transports: ["websocket", "polling", "flashsocket"],
  cors: config.server.cors,
});

// Azure Storage for the video recordings

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const blobService = azure.createBlobService(
  process.env.YOUR_AZURE_STORAGE_ACCOUNT,
  process.env.YOUR_AZURE_STORAGE_KEY
);

const containerName = "confera-recording";
// Example endpoint to get video links by room ID
app.get("/api/videos/:roomId", (req, res) => {
  const roomId = req.params.roomId;

  // List blobs in the container with metadata included
  blobService.listBlobsSegmented(
    containerName,
    null,
    { include: "metadata" },
    (err, result) => {
      if (err) {
        console.error("Error listing blobs:", err);
        return res.status(500).send("Error listing blobs");
      }

      const filteredVideoLinks = result.entries
        .filter((blob) => {
          const blobRoomId = blob.metadata && blob.metadata.roomid;
          console.log("Blob Room ID:", blobRoomId);
          return blobRoomId === roomId;
        })
        .map((blob) => {
          const sasToken = blobService.generateSharedAccessSignature(
            containerName,
            blob.name,
            {
              AccessPolicy: {
                Permissions: azure.BlobUtilities.SharedAccessPermissions.READ,
                Expiry: azure.date.minutesFromNow(10), // Set the expiration time for the link
              },
            }
          );

          return blobService.getUrl(containerName, blob.name, sasToken);
        });

      console.log("Filtered Video Links:", filteredVideoLinks);

      res.json({ videoLinks: filteredVideoLinks });
    }
  );
});

const createContainerIfNotExists = () => {
  return new Promise((resolve, reject) => {
    blobService.createContainerIfNotExists(
      containerName,
      { publicAccessLevel: "blob" },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
};

// Example endpoint to upload a video with room ID
app.post("/api/upload/:roomId", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    await createContainerIfNotExists();

    const blobName = req.file.originalname;
    const roomId = req.params.roomId;
    const stream = req.file.buffer;

    // Upload the video to Azure Blob Storage
    blobService.createBlockBlobFromText(
      containerName,
      blobName,
      stream,
      { contentSettings: { contentType: "video/mp4" } },
      (error) => {
        if (error) {
          console.error(error);
          return res
            .status(500)
            .send("Error uploading video to Azure Blob Storage");
        }

        // Set metadata to include room ID
        blobService.setBlobMetadata(
          containerName,
          blobName,
          { roomId },
          (metaError) => {
            if (metaError) {
              console.error(metaError);
              return res
                .status(500)
                .send("Error setting metadata for the video");
            }

            return res.status(200).send({
              message: "Video uploaded successfully",
            });
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error uploading video to Azure Blob Storage");
  }
});
app.get("/", (req, res) => res.end("Confera API is running..."));
app.post("/api/generate-room-id", createRoomId);
app.post("/api/create-room", createRoom);
app.post("/api/room/authenticate", authenticateRoom);
app.post("/api/join-with-link", authenticateRoomByLink);

const formatMessage = (username, text, userID) => {
  return {
    username,
    text,
    time: moment().format("h:mm a"),
    userId: userID,
  };
};

const botName = "Confera Chat";

io.on("connection", (socket) => {
  const activeSocket = activeSockets.find((user) => user.id === socket.id);

  if (!activeSocket) {
    activeSockets.push({
      id: socket.id,
      joined: false,
      roomId: null,
      secureRoom: false,
    });
  }

  socket.on("join-room", ({ roomId, username, password, secureRoom }) => {
    activeSockets.filter((user) => {
      if (user.id === socket.id) {
        user.username = username;
      }
    });
    const addRoomParticipants = (roomId, userId, username, password) =>
      secureRoom
        ? addPrivateRoomParticipants(roomId, userId, username, password)
        : addPublicRoomParticipants(roomId, userId, username);

    const room = addRoomParticipants(roomId, socket.id, username, password);
    const currentParticipants = [];
    if (!room || !room.roomId) {
      socket.emit("login-error", room);
    } else {
      const roomPrefix = secureRoom ? `${room.roomId}-SEC` : room.roomId;

      const userActiveSocket = activeSockets
        .filter((user) => user.id === socket.id)
        ?.at(0);
      if (userActiveSocket && userActiveSocket.joined === false) {
        socket.join(roomPrefix);
        activeSockets.find((user) => {
          if (user.id === socket.id) {
            user.joined = true;
            user.roomId = room.roomId;
            user.secureRoom = secureRoom;
          }
        });
        if (room.participants) {
          const peers = room.participants.map((peer) => {
            if (!currentParticipants.includes(peer.id)) return peer;
          });
          currentParticipants.push(...peers);
          socket.to(roomPrefix).emit("get-peers", peers);
        }
      }
    }
  });
  socket.on("chatMessage", (msg) => {
    const userActiveSocket = activeSockets
      .filter((user) => user.id === socket.id)
      ?.at(0);
    const defaultUsename = "Anonymous";
    const username = userActiveSocket.username || defaultUsename;
    io.to(userActiveSocket.roomId).emit(
      "message",
      formatMessage(username, msg, userActiveSocket.id)
    );
  });

  socket.on("emoji", (emoji) => {
    const emoji_received = emoji.emoji;
    const userActiveSocket = activeSockets
      .filter((user) => user.id === socket.id)
      ?.at(0);
    const defaultUsename = "Anonymous";
    const username = userActiveSocket.username || defaultUsename;
    if (userActiveSocket && userActiveSocket.roomId) {
      io.to(userActiveSocket.roomId).emit("new-emoji", {
        userId: userActiveSocket.id,
        username: username,
        emoji,
      });
    }
  });
  socket.on("offer", (payload) => {
    io.to(payload.userToSignal).emit("user-connected", {
      signal: payload.signal,
      callerID: payload.callerID,
      peerName: payload.username,
    });
  });

  socket.on("accept", (payload) => {
    io.to(payload.callerID).emit("answer", {
      signal: payload.signal,
      callerID: socket.id,
    });
  });

  socket.on("disconnect", () => {
    const userStatus = activeSockets.find((user) => user.id === socket.id);
    let currentParticipants = [];
    if (userStatus && userStatus.joined) {
      const user = userStatus;
      if (user.secureRoom) {
        currentParticipants = removePrivateRoomParticipants(
          user.roomId,
          socket.id
        );
      } else {
        currentParticipants = removePublicRoomParticipants(
          user.roomId,
          socket.id
        );
      }
    }
    if (currentParticipants) {
      const currentParticipantsIDList = currentParticipants.map(
        (participant) => participant.id
      );
      socket
        .to(userStatus.roomId)
        .emit("update-peers", currentParticipantsIDList);
    }
    socket.to(userStatus.roomId).emit("user-disconnected", {
      peerId: userStatus.id,
      peerName: userStatus.username,
    });

    activeSockets.filter((user) => user.id !== socket.id);
  });
});
