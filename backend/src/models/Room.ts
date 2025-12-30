export class Room {
  constructor(
    public id: number,
    public name: string,
    public maxParticipants: number,
    public creatorUserId: string,
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
