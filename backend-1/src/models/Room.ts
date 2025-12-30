export class Room {
  constructor(
    public id: number | null,
    public name: string,
    public isPrivate: boolean,
    public maxParticipants: number | null,
    public creatorUserId?: string | null,
    public archived: boolean = false,
    public createdAt?: string
  ) {
    if (!this.createdAt) this.createdAt = new Date().toISOString();
  }

  archive() {
    this.archived = true;
  }

  canJoin(currentCount: number): boolean {
    if (this.archived) return false;
    if (typeof this.maxParticipants === "number" && this.maxParticipants >= 0) {
      return currentCount < this.maxParticipants;
    }
    return true;
  }
}
