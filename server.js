// server.js
"use strict";

import express from "express";
import cors from "cors";
import compression from "compression";
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


app.get("/", (req, res) => res.end("Confera API is running..."));
app.post("/api/generate-room-id", createRoomId);
app.post("/api/create-room", createRoom);
app.post("/api/room/authenticate", authenticateRoom);
app.post("/api/join-with-link", authenticateRoomByLink);

io.on("connection", (socket) => {
  console.log("New User : " + socket.id);
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
    console.log(
      `Room Join Request - RoomID: ${roomId}, ${socket.id}, ${username}`
    );
    const addRoomParticipants = (roomId, userId, username, password) =>
      secureRoom
        ? addPrivateRoomParticipants(roomId, userId, username, password)
        : addPublicRoomParticipants(roomId, userId, username);

    const room = addRoomParticipants(roomId, socket.id, username, password);
    const currentParticipants = [];
    if (!room.roomId) {
      socket.emit("login-error", room);
    } else {
      const roomPrefix = secureRoom ? `${room.roomId}-SEC` : room.roomId;

      const userActiveSocket = activeSockets
        .filter((user) => user.id === socket.id)
        ?.at(0);
      if (userActiveSocket && userActiveSocket.joined === false) {
        socket.join(roomPrefix);
        console.log(`User Joined ${roomPrefix}`);

        activeSockets.find((user) => {
          if (user.id === socket.id) {
            user.joined = true;
            user.roomId = room.roomId;
            user.secureRoom = secureRoom;
          }
        });
        if (room.participants) {
          console.log(room.participants);
          const peers = room.participants.map((peer) => {
            if (!currentParticipants.includes(peer.id)) return peer.id;
          });
          currentParticipants.push(...peers);
          socket.to(roomPrefix).emit("get-peers", peers);
        }
      }
    }
  });

  socket.on("offer", (payload) => {
    io.to(payload.userToSignal).emit("user-connected", {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  socket.on("accept", (payload) => {
    console.log("SENDING ANSWER");
    io.to(payload.callerID).emit("answer", {
      signal: payload.signal,
      callerID: socket.id,
    });
  });

  socket.on("disconnect", () => {
    const userStatus = activeSockets.find((user) => user.id === socket.id);
    console.log(userStatus);
    socket.to(userStatus.roomId).emit("user-disconnected", {
      peerId: userStatus.id,
      peerName: userStatus.username,
    });
    if (userStatus && userStatus.joined) {
      const user = userStatus;
      if (user.secureRoom) {
        removePrivateRoomParticipants(user.roomId, socket.id);
      } else {
        removePublicRoomParticipants(user.roomId, socket.id);
      }
    }

    activeSockets.filter((user) => user.id !== socket.id);
  });
});
