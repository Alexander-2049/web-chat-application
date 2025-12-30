export type WSMessageType = "error" | "auth" | "data";

export class WebsocketMessage<T = unknown> {
  constructor(
    public payload:
      | {
          type: "error" | "success";
          code: string;
        }
      | {
          type: "roomData";
          data: {
            roomId: number;
            name: string;
            connectedClientsAmount: number;
            maxClients: number | null;
            creatorUserId: string;
            archived: boolean;
          };
        }
      | {
          type: "roomConnectedClients";
          data: {
            roomId: number;
            clients: {
              id: string;
              nickname: string;
            }[];
          };
        }
      | {
          type: "allActiveRooms";
          data: {
            rooms: {
              roomId: number;
              name: string;
              connectedClientsAmount: number;
              maxClients: number | null;
              creatorUserId: string;
              archived: boolean;
            }[];
          };
        }
      | {
          type: "roomDestroyed";
          data: {
            roomId: number;
          };
        }
      | {
          type: "closed";
          code: "DUBLICATE_CONNECTION";
        }
  ) {}

  public json() {
    return JSON.stringify(this.payload);
  }
}
