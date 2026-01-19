import { describe, expect, it } from "vitest";

import { User } from "./User";

describe("User", () => {
  it("updates nickname when provided", () => {
    const user = new User("user-1", "Original");

    user.setProfile("Updated");

    expect(user.nickname).toBe("Updated");
  });

  it("keeps nickname when undefined is passed", () => {
    const user = new User("user-2", "Initial");

    user.setProfile(undefined);

    expect(user.nickname).toBe("Initial");
  });
});
