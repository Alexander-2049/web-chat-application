export interface WSErrorMessage {
  type: "error";
  code: string;
}

export interface WSSuccessMessage {
  type: "success";
  code: string;
}

export interface WSAuthOkMessage {
  type: "auth_ok";
  userId: string;
}

export interface WSUserIdIssuedMessage {
  type: "userIdIssued";
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

export interface WSChatMessage {
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

export type WSOutgoingMessage =
  | WSErrorMessage
  | WSSuccessMessage
  | WSAuthOkMessage
  | WSUserIdIssuedMessage
  | WSRoomDataMessage
  | WSRoomConnectedClientsMessage
  | WSAllActiveRoomsMessage
  | WSAllArchivedRoomsMessage
  | WSRoomDestroyedMessage
  | WSClosedMessage
  | WSChatMessage;

export class WebsocketMessage<T extends WSOutgoingMessage> {
  constructor(public payload: T) {}

  json(): string {
    return JSON.stringify(this.payload);
  }
}
