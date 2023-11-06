const privateRoomStore = [];
const publicRoomStore = [];

const generateRandomRoomNumber = () => {
  return `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
    1000 + Math.random() * 9000
  )}-${Math.floor(1000 + Math.random() * 9000)}`;
};

const generatePublicRoomId = async () => {
  const roomId = generateRandomRoomNumber();
  const roomExists = publicRoomStore.find((room) => room.roomId === roomId);
  if (roomExists) {
    const newRoomId = await generatePublicRoomId();
    return newRoomId;
  } else {
    return roomId;
  }
};

const generatePrivateRoomId = async () => {
  const roomId = generateRandomRoomNumber();
  const roomExists = privateRoomStore.find((room) => room.roomId === roomId);
  if (roomExists) {
    const newRoomId = await generatePrivateRoomId();
    return newRoomId;
  } else {
    return roomId;
  }
};

const addPublicRoom = (roomId, joinLink, userCount) => {
  const roomExists = publicRoomStore.find((room) => room.roomId == roomId);
  if (roomExists) {
    return {
      success: false,
      message: "Room Already exists. Please try another Room ID",
    };
  } else {
    const newRoom = {
      roomId,
      participants: [],
      joinLink,
      userCount,
    };
    publicRoomStore.push(newRoom);
    return { success: true };
  }
};

const addPrivateRoom = (roomId, password, joinLink, userCount) => {
  const roomExists = privateRoomStore.find((room) => room.roomId == roomId);
  if (roomExists) {
    return {
      success: false,
      message: "Room Already exists. Please try another Room ID",
    };
  } else {
    const newRoom = {
      roomId,
      participants: [],
      password,
      joinLink,
      userCount,
    };
    privateRoomStore.push(newRoom);
    return { success: true };
  }
};

const addPrivateRoomParticipants = (roomId, userId, username, password) => {
  const result = privateRoomStore.filter((room) => {
    if (room.roomId === roomId) {
      if (room.password === password) {
        const hasParticipant = room.participants.find(
          (user) => user.id == userId
        );
        if (!hasParticipant) {
          room.participants.push({ id: userId, name: username });
          room.userCount += 1;
          return { success: true, room };
        } else {
          return {
            success: false,
            message: "User is already added to the room.",
          };
        }
      } else {
        return {
          success: false,
          message: "Incorrect credentials. Please try again.",
        };
      }
    }
  });
  if (result) {
    return result[0];
  } else {
    return { success: false, message: "Room doesn't exist" };
  }
};

const addPublicRoomParticipants = (roomId, userId, username) => {
  const result = publicRoomStore.filter((room) => {
    if (room.roomId === roomId) {
      const hasParticipant = room.participants.find(
        (user) => user.id == userId
      );
      if (!hasParticipant) {
        room.participants.push({ id: userId, name: username });
        room.userCount += 1;
        return { success: true, room };
      } else {
        return {
          success: false,
          message: "User is already added to the room.",
        };
      }
    }
  });
  if (result) {
    return result[0];
  } else {
    return { success: false, message: "Room doesn't exist" };
  }
};

const removePrivateRoomParticipants = (roomId, userId) => {
  const roomIndex = privateRoomStore.findIndex(
    (room) => room.roomId === roomId
  );
  if (
    privateRoomStore[roomIndex].userCount !== 0 &&
    privateRoomStore[roomIndex].participants.find(
      (participant) => participant.id === userId
    )
  ) {
    const participantIndex = privateRoomStore[roomIndex].participants.findIndex(
      (user) => user.id === userId
    );
    privateRoomStore[roomIndex].participants.splice(participantIndex, 1);
    privateRoomStore[roomIndex].userCount += -1;
  }
};

const removePublicRoomParticipants = (roomId, userId) => {
  const roomIndex = publicRoomStore.findIndex((room) => room.roomId === roomId);
  if (
    publicRoomStore[roomIndex].userCount !== 0 &&
    publicRoomStore[roomIndex].participants.find(
      (participant) => participant.id === userId
    )
  ) {
    const participantIndex = publicRoomStore[roomIndex].participants.findIndex(
      (user) => user.id === userId
    );
    publicRoomStore[roomIndex].participants.splice(participantIndex, 1);
    publicRoomStore[roomIndex].userCount += -1;
  }
};

const removePublicRoom = (roomId) => {
  const roomIndex = publicRoomStore.findIndex((room) => room.roomId === roomId);
  publicRoomStore.splice(roomIndex, 1);
};

const removePrivateRoom = (roomId) => {
  const roomIndex = privateRoomStore.findIndex(
    (room) => room.roomId === roomId
  );
  privateRoomStore.splice(roomIndex, 1);
};

const getRoom = (roomId, password, secureRoom = false) => {
  const roomArray = secureRoom ? privateRoomStore : publicRoomStore;
  const room = roomArray.filter(
    (roomItem) =>
      roomItem.roomId === roomId &&
      (secureRoom ? roomItem.password === password : true)
  );
  if (room.length > 0) {
    return {
      success: true,
      joinLink: room[0] ? room[0].joinLink : null,
      message: "Authenticated Successfully",
    };
  } else {
    return {
      success: false,
      message: "Room doesn't exist. Try Creating a new Room.",
    };
  }
};

const getRoomByJoinLink = (joinLink) => {
  const privateRoomFound = privateRoomStore.filter(
    (roomItem) => roomItem.joinLink === joinLink
  );
  if (privateRoomFound.length > 0 && privateRoomFound[0]) {
    return {
      success: true,
      roomId: privateRoomFound[0].roomId,
      joinLink: joinLink,
      isPrivateRoom: true,
      message: "Authenticated Successfully",
    };
  }
  const publicRoomFound = publicRoomStore.filter(
    (roomItem) => roomItem.joinLink === joinLink
  );
  if (publicRoomFound.length > 0 && publicRoomFound[0]) {
    return {
      success: true,
      roomId: publicRoomFound[0].roomId,
      joinLink: joinLink,
      isPrivateRoom: false,
      message: "Authenticated Successfully",
    };
  }
  return {
    success: false,
    message: "Room doesn't exist or the Join Link has expired. Please try again with a new Link.",
  };
};

export {
  generatePrivateRoomId,
  generatePublicRoomId,
  addPrivateRoom,
  addPublicRoom,
  addPrivateRoomParticipants,
  addPublicRoomParticipants,
  removePrivateRoom,
  removePublicRoom,
  removePrivateRoomParticipants,
  removePublicRoomParticipants,
  getRoom,
  getRoomByJoinLink,
};
