import { describe, expect, it } from "vitest";

import { Room } from "./Room";

describe("Room", () => {
  it("defaults createdAt to an ISO timestamp", () => {
    const room = new Room(1, "General", 10, "creator-1");

    expect(room.createdAt).not.toBe("-1");
    expect(Number.isNaN(Date.parse(room.createdAt))).toBe(false);
  });

  it("keeps provided createdAt value", () => {
    const createdAt = "2024-01-01T00:00:00.000Z";
    const room = new Room(2, "History", 5, "creator-2", false, createdAt);

    expect(room.createdAt).toBe(createdAt);
  });

  it("prevents joins when archived", () => {
    const room = new Room(3, "Archive", 10, "creator-3");

    room.archive();

    expect(room.archived).toBe(true);
    expect(room.canJoin(0)).toBe(false);
  });

  it("allows joins until maxParticipants is reached", () => {
    const room = new Room(4, "Capacity", 2, "creator-4");

    expect(room.canJoin(0)).toBe(true);
    expect(room.canJoin(1)).toBe(true);
    expect(room.canJoin(2)).toBe(false);
  });

  it("allows joins when maxParticipants is negative", () => {
    const room = new Room(5, "Unlimited", -1, "creator-5");

    expect(room.canJoin(100)).toBe(true);
  });
});
