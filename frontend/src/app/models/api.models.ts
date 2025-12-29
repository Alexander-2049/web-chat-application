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
  id: number;
  name: string;
  isPrivate: boolean;
  maxParticipants: number | null;
  currentParticipants: number;
  creatorUserId: string;
}

export interface CreateRoomRequest {
  name: string;
  isPrivate: boolean;
  maxParticipants: number;
  creatorUserId: string;
}

// Message models
export interface Message {
  id: number; // OK
  roomId: number; // OK
  userId: string; // OK
  nickname: string | null; // OK
  color: string | null; // OK
  // avatarUrl: string;
  content: string; // OK
  sentAt: string; // OK
}

// WebSocket message types
export interface WSMessage {
  type: string;
  [key: string]: any;
}

export interface WSInitMessage extends WSMessage {
  type: 'auth';
  userId?: string;
}

export interface WSProfileMessage extends WSMessage {
  type: 'profile';
  nickname: string;
  color: string;
  avatarUrl: string;
}

export interface WSJoinMessage extends WSMessage {
  type: 'join';
  roomId: number;
}

export interface WSLeaveMessage extends WSMessage {
  type: 'leave';
  roomId: number;
}

export interface WSSendMessage extends WSMessage {
  type: 'message';
  roomId: number;
  content: string;
}

export interface WSDeleteRoomMessage extends WSMessage {
  type: 'deleteRoom';
  roomId: number;
}

export interface WSWelcomeMessage extends WSMessage {
  type: 'welcome';
  userId: string;
}

export interface WSHistoryMessage extends WSMessage {
  type: 'history';
  roomId: number;
  messages: Message[];
}

export interface WSIncomingMessage extends WSMessage {
  type: 'message';
  message: Message;
}

export interface WSRoomUpdateMessage extends WSMessage {
  type: 'roomUpdate';
  room: Room;
}

export interface WSRoomsListUpdateMessage extends WSMessage {
  type: 'roomsListUpdate';
  rooms: Room[];
}

export interface WSRoomDeletedMessage extends WSMessage {
  type: 'roomDeleted';
  roomId: number;
}

export interface WSErrorMessage extends WSMessage {
  type: 'error';
  message: string;
}
