import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import type {
  WSMessage,
  WSInitMessage as WSAuthMessage,
  WSProfileMessage,
  WSJoinMessage,
  WSLeaveMessage,
  WSSendMessage,
  WSDeleteRoomMessage,
} from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<WSMessage>();
  private connectionStatus = new BehaviorSubject<boolean>(false);

  public messages$: Observable<WSMessage> = this.messageSubject.asObservable();
  public isConnected$: Observable<boolean> =
    this.connectionStatus.asObservable();

  constructor() {}

  connect(userId: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('[v0] WebSocket already connected');
      return;
    }

    this.socket = new WebSocket(API_CONFIG.WS_URL);

    this.socket.onopen = () => {
      console.log('[v0] WebSocket connected');
      const message: WSAuthMessage = {
        type: 'auth',
        userId,
      };
      this.send(message);
      this.connectionStatus.next(true);
    };

    this.socket.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        console.log('[v0] WebSocket message received:', message);
        this.messageSubject.next(message);
      } catch (error) {
        console.error('[v0] Error parsing WebSocket message:', error);
      }
    };

    this.socket.onerror = (error) => {
      console.error('[v0] WebSocket error:', error);
    };

    this.socket.onclose = () => {
      console.log('[v0] WebSocket disconnected');
      this.connectionStatus.next(false);
    };
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connectionStatus.next(false);
    }
  }

  private send(message: WSMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      console.log('[v0] WebSocket message sent:', message);
    } else {
      console.error('[v0] WebSocket is not connected');
    }
  }

  // Client to server messages
  sendAuth(userId: string): void {
    const message: WSAuthMessage = {
      type: 'auth',
      userId,
    };

    this.send(message);
  }

  sendProfile(nickname: string, color: string, avatarUrl: string): void {
    const message: WSProfileMessage = {
      type: 'profile',
      nickname,
      color,
      avatarUrl,
    };
    this.send(message);
  }

  joinRoom(roomId: number): void {
    const message: WSJoinMessage = {
      type: 'join',
      roomId,
    };
    this.send(message);
  }

  leaveRoom(roomId: number): void {
    const message: WSLeaveMessage = {
      type: 'leave',
      roomId,
    };
    this.send(message);
  }

  sendMessage(roomId: number, content: string): void {
    const message: WSSendMessage = {
      type: 'message',
      roomId,
      content,
    };
    this.send(message);
  }

  deleteRoom(roomId: number): void {
    const message: WSDeleteRoomMessage = {
      type: 'deleteRoom',
      roomId,
    };
    this.send(message);
  }

  // Helper methods to filter messages by type
  getMessagesOfType<T extends WSMessage>(type: string): Observable<T> {
    return new Observable((observer) => {
      const subscription = this.messages$.subscribe((message) => {
        if (message.type === type) {
          observer.next(message as T);
        }
      });
      return () => subscription.unsubscribe();
    });
  }
}
