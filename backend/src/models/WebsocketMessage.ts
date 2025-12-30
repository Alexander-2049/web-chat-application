export type WSMessageType = "error" | "auth" | "data";

export class WebsocketMessage<T = unknown> {
  constructor(
    public payload:
      | {
          type: "error" | "success";
          code: string;
        }
      | {
          type: "data";
          data: T;
        }
  ) {}

  public json() {
    return JSON.stringify(this.payload);
  }
}
