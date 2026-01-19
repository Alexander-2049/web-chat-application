import { describe, expect, it } from "vitest";

import {
  WebsocketMessage,
  WSSuccessMessage,
  WSArchivedRoomDataMessage,
} from "./WebsocketMessage";

describe("WebsocketMessage", () => {
  it("serializes a success payload to JSON", () => {
    const payload: WSSuccessMessage = { type: "success", code: "OK" };
    const message = new WebsocketMessage(payload);

    expect(message.json()).toBe(JSON.stringify(payload));
  });

  it("serializes nested payloads", () => {
    const payload: WSArchivedRoomDataMessage = {
      type: "archivedRoomData",
      data: {
        room: {
          roomId: 10,
          name: "History",
          creatorUserId: "creator-1",
          createdAt: "2024-01-01T00:00:00.000Z",
          archived: true,
        },
        messages: [
          {
            id: 1,
            userId: "user-1",
            nickname: "Ada",
            content: "Hello",
            sentAt: "2024-01-01T00:01:00.000Z",
          },
        ],
      },
    };

    const message = new WebsocketMessage(payload);

    expect(message.json()).toBe(JSON.stringify(payload));
  });
});
