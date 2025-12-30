# Chat WebSocket API – ENDPOINTS.md

Base URL: **[http://localhost:8080](http://localhost:8080)**
WebSocket Path: **/ws/chat**

This document describes the full WebSocket protocol used by the Chat backend. It is intended for frontend developers who will integrate real-time chat functionality.

---

## 1. Connection

### WebSocket URL

```
ws://localhost:8080/ws/chat
```

After connection, the client **must authenticate within 5 seconds**, otherwise the server will close the connection.

---

## 2. Authentication

### Client → Server

#### `auth`

```json
{
  "type": "auth",
  "userId": "string"
}
```

* `userId` must be a unique string
* If the same `userId` connects again, the previous connection is closed

### Server → Client

#### `auth_ok`

```json
{
  "type": "auth_ok",
  "userId": "string"
}
```

#### Possible Errors

```json
{
  "type": "error",
  "code": "AUTH_TIMEOUT | UNAUTHORIZED"
}
```

---

## 3. Global Room Queries

### Client → Server

#### `getAllRooms`

Requests all **active (non-archived)** rooms.

```json
{
  "type": "getAllRooms"
}
```

### Server → Client

#### `allActiveRooms`

```json
{
  "type": "allActiveRooms",
  "data": {
    "rooms": [
      {
        "roomId": 1,
        "name": "Room name",
        "connectedClientsAmount": 2,
        "maxClients": 10,
        "creatorUserId": "user123",
        "archived": false
      }
    ]
  }
}
```

---

### Client → Server

#### `getAllArchivedRooms`

Requests all archived rooms.

```json
{
  "type": "getAllArchivedRooms"
}
```

### Server → Client

#### `allArchivedRooms`

```json
{
  "type": "allArchivedRooms",
  "data": {
    "rooms": [
      {
        "roomId": 5,
        "name": "Old room",
        "creatorUserId": "user123",
        "createdAt": "2024-12-01T12:00:00Z"
      }
    ]
  }
}
```

---

## 4. Joining & Leaving Rooms

### Client → Server

#### `joinRoom`

```json
{
  "type": "joinRoom",
  "roomId": 1,
  "nickname": "CoolUser"
}
```

**Rules:**

* `nickname` must be a non-empty string
* Cannot join archived rooms
* Cannot exceed room max capacity

#### Possible Errors

```json
{
  "type": "error",
  "code": "NICKNAME_REQUIRED | ROOM_NOT_FOUND | ROOM_ARCHIVED | ROOM_FULL"
}
```

---

### Server → Client (on successful join)

#### `chatMessage` (history replay)

Sent for **each stored message** in the room.

```json
{
  "type": "chatMessage",
  "data": {
    "roomId": 1,
    "id": 42,
    "userId": "user123",
    "nickname": "CoolUser",
    "content": "Hello!",
    "sentAt": "2024-12-01T12:05:00Z"
  }
}
```

---

## 5. Room State Updates (Server Push)

### `roomData`

Sent to all room participants whenever room state changes.

```json
{
  "type": "roomData",
  "data": {
    "roomId": 1,
    "name": "Room name",
    "connectedClientsAmount": 3,
    "maxClients": 10,
    "creatorUserId": "user123",
    "archived": false
  }
}
```

---

### `roomConnectedClients`

```json
{
  "type": "roomConnectedClients",
  "data": {
    "roomId": 1,
    "clients": [
      {
        "id": "user123",
        "nickname": "CoolUser"
      }
    ]
  }
}
```

---

## 6. Messaging

### Client → Server

#### `sendMessage`

```json
{
  "type": "sendMessage",
  "roomId": 1,
  "content": "Hello everyone"
}
```

* Client **must be joined** to the room

---

### Server → Client

#### `chatMessage`

Broadcast to **all participants** of the room.

```json
{
  "type": "chatMessage",
  "data": {
    "roomId": 1,
    "id": 43,
    "userId": "user456",
    "nickname": "AnotherUser",
    "content": "Hi!",
    "sentAt": "2024-12-01T12:06:00Z"
  }
}
```

---

## 7. Room Archiving

Rooms can be archived automatically or manually.

### Automatic

* If **no activity** occurs for `chatLifeDurationSeconds` (default **120s**)

### Manual (Owner Only)

#### Client → Server

```json
{
  "type": "archiveRoom",
  "roomId": 1
}
```

#### Possible Error

```json
{
  "type": "error",
  "code": "NOT_ROOM_OWNER"
}
```

---

### Server → Client

#### `roomDestroyed`

Sent to all participants when a room is archived.

```json
{
  "type": "roomDestroyed",
  "data": {
    "roomId": 1
  }
}
```

Clients are automatically removed from the room.

---

## 8. Connection Closure

### `closed`

Sent when a duplicate connection with the same `userId` is detected.

```json
{
  "type": "closed",
  "code": "DUBLICATE_CONNECTION"
}
```

---

## 9. Generic Errors

```json
{
  "type": "error",
  "code": "INVALID_JSON | UNKNOWN_MESSAGE_TYPE"
}
```

---

## 10. Notes for Frontend Developers

* Expect **server push updates** (room lists, participants, messages)
* Always handle `roomDestroyed`
* Re-request `getAllRooms` after reconnect
* WebSocket messages are **JSON only**

---

**End of document**
