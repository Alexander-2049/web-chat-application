# WebSocket Chat API

**Endpoint:** `ws://<host>/ws/chat`

This document describes the full WebSocket communication protocol between client and server.

---

## Connection Lifecycle

### 1. Connect

Client opens a WebSocket connection to:

```
ws://<host>/ws/chat
```

### 2. Authentication (required)

The very first message **must** be authentication.

#### Client → Server

```json
{
  "type": "auth",
  "userId": "string"
}
```

* `userId` must be globally unique
* Only **one active connection per userId** is allowed

#### Server → Client (success)

```json
{
  "type": "auth_ok",
  "userId": "string"
}
```

#### Server → Client (errors)

```json
{ "type": "error", "code": "UNAUTHORIZED" }
{ "type": "error", "code": "AUTH_TIMEOUT" }
```

#### Duplicate connection handling

If the same `userId` connects again:

```json
{ "type": "closed", "code": "DUBLICATE_CONNECTION" }
```

The **previous connection is closed**, the new one becomes active.

---

## Rooms

### Get all active rooms

#### Client → Server

```json
{ "type": "getAllRooms" }
```

#### Server → Client

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

### Get all archived rooms

#### Client → Server

```json
{ "type": "getAllArchivedRooms" }
```

#### Server → Client

```json
{
  "type": "allArchivedRooms",
  "data": {
    "rooms": [
      {
        "roomId": 5,
        "name": "Old room",
        "creatorUserId": "user123",
        "createdAt": "2025-01-01T12:00:00.000Z"
      }
    ]
  }
}
```

Archived rooms are **read-only**.

---

### Join room

#### Client → Server

```json
{
  "type": "joinRoom",
  "roomId": 1
}
```

#### Possible errors

```json
{ "type": "error", "code": "ROOM_NOT_FOUND" }
{ "type": "error", "code": "ROOM_ARCHIVED" }
{ "type": "error", "code": "ROOM_FULL" }
```

#### On success (server pushes automatically)

* Full message history (`chatMessage`)
* Current room metadata
* Connected clients list
* Updated global rooms list

---

### Leave room

#### Client → Server

```json
{
  "type": "leaveRoom",
  "roomId": 1
}
```

Triggers room state updates for all participants.

---

## Messages

### Send message

#### Client → Server

```json
{
  "type": "sendMessage",
  "roomId": 1,
  "content": "Hello world"
}
```

Client **must be joined** to the room.

#### Server → Room participants

```json
{
  "type": "chatMessage",
  "data": {
    "roomId": 1,
    "id": 42,
    "userId": "user123",
    "nickname": "John",
    "content": "Hello world",
    "sentAt": "2025-01-01T12:00:00.000Z"
  }
}
```

All messages are persisted.

---

## Room State Streaming

### Room metadata update

Sent to **room participants** whenever state changes.

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

### Connected clients list

```json
{
  "type": "roomConnectedClients",
  "data": {
    "roomId": 1,
    "clients": [
      { "id": "user123", "nickname": "John" }
    ]
  }
}
```

---

### Room destroyed / archived

Sent when a room becomes archived due to inactivity.

```json
{
  "type": "roomDestroyed",
  "data": { "roomId": 1 }
}
```

Client must leave the room locally.

---

## Automatic Behavior

* Rooms auto-archive after inactivity timeout
* Any room activity updates last-activity timestamp
* Join / leave / message triggers global room list update
* Messages are streamed only to room participants

---

## Error Codes

| Code                 | Meaning                              |
| -------------------- | ------------------------------------ |
| UNAUTHORIZED         | Auth message missing or invalid      |
| AUTH_TIMEOUT         | No auth within 5 seconds             |
| DUBLICATE_CONNECTION | Another connection replaced this one |
| ROOM_NOT_FOUND       | Room does not exist                  |
| ROOM_ARCHIVED        | Room is archived                     |
| ROOM_FULL            | Room capacity reached                |
| UNKNOWN_MESSAGE_TYPE | Unsupported message type             |

---

## Notes

* JSON only
* Order of messages is guaranteed per connection
* Reconnection requires re-authentication
