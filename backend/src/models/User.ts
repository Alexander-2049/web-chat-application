export class User {
  constructor(public id: string, public nickname: string) {}

  setProfile(nickname?: string) {
    this.nickname = nickname ?? this.nickname;
  }
}
