import { getRoom, getRoomByJoinLink } from "../store/roomStore.js";

const authenticateRoom = (req, res) => {
  const { roomId, secureRoom, password } = req.body;
  const result = getRoom(roomId, password, secureRoom);
  return res.json(result);
};

const authenticateRoomByLink = (req, res) => {
  const { joinLink } = req.body;
  const result = getRoomByJoinLink(joinLink);
  return res.json(result);
};

export { authenticateRoom, authenticateRoomByLink };
