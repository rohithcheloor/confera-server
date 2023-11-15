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

app.get("/", (req, res) => res.end("Confera API is running..."));
app.post("/api/generate-room-id", createRoomId);
app.post("/api/create-room", createRoom);
app.post("/api/room/authenticate", authenticateRoom);
app.post("/api/join-with-link", authenticateRoomByLink);

const formatMessage = (username, text, userID) => {
  console.log("User :", userID);
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
    if (!room.roomId) {
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

        socket.emit("message", "Welcome to chat");
        const defaultUsename = "Anonymous";
        const username = userActiveSocket.username || defaultUsename;
        socket.broadcast
          .to(room.roomId)
          .emit(
            "message",
            formatMessage(botName, `${username} has joined the chat`, userActiveSocket.id)
          );
      }
    }
  });
  socket.on("chatMessage", (msg) => {
    const userActiveSocket = activeSockets
      .filter((user) => user.id === socket.id)
      ?.at(0);
    const defaultUsename = "Anonymous";
    const username = userActiveSocket.username || defaultUsename;
    console.log("Received Chat from :" + userActiveSocket.id);
    io.to(userActiveSocket.roomId).emit(
      "message",
      formatMessage(username, msg, userActiveSocket.id)
    );
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

    const userActiveSocket = activeSockets
      .filter((user) => user.id === socket.id)
      ?.at(0);
    if (userActiveSocket) {
      io.to(userActiveSocket.roomId).emit(
        "message",
        formatMessage(
          botName,
          `${userActiveSocket.username} has left the chat`,
          userActiveSocket.id
        )
      );
    }
  });
});
