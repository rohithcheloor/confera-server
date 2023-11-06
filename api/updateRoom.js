import { addPrivateRoomParticipants, addPublicRoomParticipants }from '../store/roomStore.js';

const addPublicUserToRoom = (roomId, participantId, username) => {
    const userAdded = addPublicRoomParticipants(roomId, participantId, username)
    return userAdded;
}

const addPrivateUserToRoom = (roomId, participantId, username, password) => {
    const userAdded = addPrivateRoomParticipants(roomId, participantId, username, password)
    return userAdded;
}

export { addPrivateUserToRoom, addPublicUserToRoom }