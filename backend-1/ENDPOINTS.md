# API Endpoints Documentation (ENDPOINTS.md)

This document describes **all HTTP and WebSocket endpoints** available
in the OOP Chat Backend.

Base URL:

    http://localhost:8080

WebSocket URL:

    ws://localhost:8080/ws/chat

------------------------------------------------------------------------

# 1. HTTP REST API

------------------------------------------------------------------------

## 1.1 Profile

### **POST /api/profile/avatar**

Upload and process a user avatar.

**Content-Type:** `multipart/form-data`

**Fields:** - `userId` --- string, required\
- `file` --- binary image (jpeg/png/jpg/webp/gif ≤ 20MB)

**Response 201:**

``` json
{
  "avatarUrl": "/uploads/avatars/<avatar>.png"
}
```

------------------------------------------------------------------------

### **POST /api/profile/save**

Save or update a user's profile.

**Content-Type:** `application/json`

**Body:**

``` json
{
  "userId": "uuid",
  "nickname": "Bob",
  "color": "#aabbcc",
  "avatarPath": "/uploads/avatars/file.png"
}
```

**Response 200:**

``` json
{ "ok": true }
```

------------------------------------------------------------------------

## 1.2 Rooms (Active)

### **GET /api/rooms**

Returns a list of **active public rooms**.

------------------------------------------------------------------------

### **POST /api/rooms**

Create a new room.

**Body:**

``` json
{
  "name": "Room Name",
  "isPrivate": false,
  "maxParticipants": 10,
  "creatorUserId": "uuid"
}
```

**Response 201:** room object.

------------------------------------------------------------------------

## 1.3 Archive

### **GET /api/archive/rooms**

Returns **archived rooms**.

------------------------------------------------------------------------

### **GET /api/archive/rooms/{id}**

Returns **full message history** for the archived room.

------------------------------------------------------------------------

# 2. WebSocket API

WebSocket endpoint:

    ws://localhost:8080/ws/chat

On connect:

``` json
{
  "type": "welcome",
  "userId": "<uuid>"
}
```

------------------------------------------------------------------------

# 3. Client → Server WebSocket Messages

### **init**

``` json
{ "type": "init", "userId": "<uuid or omitted>" }
```

### **profile**

``` json
{
  "type": "profile",
  "nickname": "Bob",
  "color": "#aabbcc",
  "avatarUrl": "/uploads/avatars/img.png"
}
```

### **join**

``` json
{ "type": "join", "roomId": 1 }
```

### **leave**

``` json
{ "type": "leave", "roomId": 1 }
```

### **message**

``` json
{ "type": "message", "roomId": 1, "content": "text" }
```

### **deleteRoom**

``` json
{ "type": "deleteRoom", "roomId": 1 }
```

------------------------------------------------------------------------

# 4. Server → Client WebSocket Messages

### **welcome**

### **history**

### **message**

### **roomUpdate**

### **roomsListUpdate**

### **roomDeleted**

### **error**

(Full schemas included in original document.)

------------------------------------------------------------------------

# End of Document
