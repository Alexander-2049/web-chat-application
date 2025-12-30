// Profile models
export interface ProfileSaveRequest {
  userId: string;
  nickname: string;
  color: string;
  avatarPath: string;
}

export interface AvatarUploadResponse {
  avatarUrl: string;
}

// Room models
export interface Room {
  roomId: number;
  name: string;
  connectedClientsAmount: number;
  maxClients: number | null;
  creatorUserId: string;
  archived: boolean;
}

export interface CreateRoomRequest {
  name: string;
  maxParticipants: number;
  creatorUserId: string;
}

// Message models
export interface Message {
  id: number;
  roomId: number;
  userId: string;
  nickname: string;
  content: string;
  sentAt: string;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  [key: string]: any;
}

// Outgoing messages (client -> server)
export interface WSRequestUserIdMessage {
  type: "requestUserId";
}

export interface WSAuthMessage {
  type: "auth";
  userId: string;
}

export interface WSGetAllRoomsMessage {
  type: "getAllRooms";
}

export interface WSGetAllArchivedRoomsMessage {
  type: "getAllArchivedRooms";
}

export interface WSJoinRoomMessage {
  type: "joinRoom";
  roomId: number;
  nickname: string;
}

export interface WSArchiveRoomMessage {
  type: "archiveRoom";
  roomId: number;
}

export interface WSSendMessageMessage {
  type: "sendMessage";
  roomId: number;
  content: string;
}

export interface WSCreateRoomMessage {
  type: "createRoom";
  name: string;
  maxParticipants: number | null;
}

// Incoming messages (server -> client)
export interface WSUserIdIssuedMessage {
  type: "userIdIssued";
  userId: string;
}

export interface WSAuthOkMessage {
  type: "auth_ok";
  userId: string;
}

export interface WSRoomDataMessage {
  type: "roomData";
  data: {
    roomId: number;
    name: string;
    connectedClientsAmount: number;
    maxClients: number | null;
    creatorUserId: string;
    archived: boolean;
  };
}

export interface WSRoomConnectedClientsMessage {
  type: "roomConnectedClients";
  data: {
    roomId: number;
    clients: {
      id: string;
      nickname: string;
    }[];
  };
}

export interface WSAllActiveRoomsMessage {
  type: "allActiveRooms";
  data: {
    rooms: {
      roomId: number;
      name: string;
      connectedClientsAmount: number;
      maxClients: number | null;
      creatorUserId: string;
      archived: boolean;
    }[];
  };
}

export interface WSAllArchivedRoomsMessage {
  type: "allArchivedRooms";
  data: {
    rooms: {
      roomId: number;
      name: string;
      creatorUserId: string;
      createdAt: string;
    }[];
  };
}

export interface WSRoomDestroyedMessage {
  type: "roomDestroyed";
  data: {
    roomId: number;
  };
}

export interface WSClosedMessage {
  type: "closed";
  code: "DUBLICATE_CONNECTION";
}

export interface WSChatMessageMessage {
  type: "chatMessage";
  data: {
    roomId: number;
    id: number;
    userId: string;
    nickname: string;
    content: string;
    sentAt: string;
  };
}

export interface WSErrorMessage {
  type: "error";
  code: string;
}

export interface WSSuccessMessage {
  type: "success";
  code: string;
}
