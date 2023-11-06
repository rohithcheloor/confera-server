import {
  addPrivateRoom,
  generatePrivateRoomId,
  generatePublicRoomId,
  addPublicRoom,
} from "../store/roomStore.js";
import CryptoJS from "crypto-js";

const createJoinLink = (roomId, password = "confera") => {
  const aesIv = CryptoJS.enc.Utf8.parse(
    "0123456789abcdefghijklmnopqrstuvwxyz_+-@"
  );
  const aesOptions = {
    iv: aesIv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  };
  const joinLink = CryptoJS.AES.encrypt(roomId, password, aesOptions).ciphertext.toString();
  console.log("JOIN:LINK ::: ", joinLink);
  return joinLink;
};

const createRoom = async (req, res) => {
  const {
    roomId,
    userId,
    username = "Anonymous User",
    password,
    enableSecureRoom,
  } = req.body;
  const joinLink = createJoinLink(
    roomId,
    enableSecureRoom ? password : "confera"
  );
  if (enableSecureRoom == true) {
    const isCreated = addPrivateRoom(roomId, password, joinLink, 0);
    if (isCreated.success === false) {
      await res.json(isCreated);
      res.end();
      return isCreated;
    }
  } else {
    const isCreated = addPublicRoom(roomId, joinLink, 0);
    if (isCreated.success === false) {
      await res.json(isCreated);
      res.end();
      return isCreated;
    }
  }
  const data = await res.json({
    roomId,
    joinLink,
    isPrivateRoom: enableSecureRoom,
  });
  res.end();
  return data;
};

const createRoomId = async (req, res) => {
  const { enableSecureRoom } = req.body;
  if (enableSecureRoom) {
    const roomId = await generatePrivateRoomId();
    res.json({ roomId, isPrivateRoom: true });
    res.end();
  } else {
    const roomId = await generatePublicRoomId();
    res.json({ roomId, isPrivateRoom: false });
    res.end();
  }
};
export { createRoom, createRoomId };
