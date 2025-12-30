export class Message {
  constructor(
    public messageId: number | null,
    public roomId: number,
    public userId: string,
    public nickname: string,
    public content: string,
    public sentAt: string = "-1"
  ) {
    if (this.sentAt === "-1") this.sentAt = new Date().toISOString();
  }
}
