import { describe, expect, it } from "vitest";

import { Message } from "./Message";

describe("Message", () => {
  it("defaults sentAt to an ISO timestamp", () => {
    const message = new Message(null, 1, "user-1", "Alice", "Hello");

    expect(message.sentAt).not.toBe("-1");
    expect(Number.isNaN(Date.parse(message.sentAt))).toBe(false);
  });

  it("keeps provided sentAt value", () => {
    const sentAt = "2024-01-01T00:00:00.000Z";
    const message = new Message(1, 2, "user-2", "Bob", "Hi", sentAt);

    expect(message.sentAt).toBe(sentAt);
  });
});
