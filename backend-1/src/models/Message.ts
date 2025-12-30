export class Message {
  constructor(
    public id: number | null,
    public roomId: number,
    public userId: string,
    public nickname: string | null,
    public color: string | null,
    public content: string,
    public sentAt?: string
  ) {
    if (!this.sentAt) this.sentAt = new Date().toISOString();
  }
}
