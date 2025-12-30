export class User {
  constructor(
    public id: string,
    public nickname?: string | null,
    public color?: string | null,
    public avatarPath?: string | null,
    public connected: boolean = false,
    public lastSeen?: string | null
  ) {}

  setProfile(nickname?: string, color?: string, avatarPath?: string) {
    this.nickname = nickname ?? this.nickname;
    this.color = color ?? this.color;
    this.avatarPath = avatarPath ?? this.avatarPath;
  }

  touchConnected(connected: boolean) {
    this.connected = connected;
    this.lastSeen = new Date().toISOString();
  }
}
