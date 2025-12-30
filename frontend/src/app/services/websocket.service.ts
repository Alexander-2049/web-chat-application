import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { WSMessage } from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<WSMessage>();
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private authenticated = new BehaviorSubject<boolean>(false);

  public messages$: Observable<WSMessage> = this.messageSubject.asObservable();
  public isConnected$: Observable<boolean> = this.connectionStatus.asObservable();
  public isAuthenticated$: Observable<boolean> = this.authenticated.asObservable();

  constructor() {}

  connect(userId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        console.log('[v0] WebSocket already connected');
        resolve(userId || '');
        return;
      }

      this.socket = new WebSocket(API_CONFIG.WS_URL);

      this.socket.onopen = () => {
        console.log('[v0] WebSocket connected');
        this.connectionStatus.next(true);

        if (userId) {
          // Authenticate with existing userId
          this.send({ type: 'auth', userId });

          // Wait for auth_ok
          const authSub = this.getMessagesOfType<any>('auth_ok').subscribe((msg) => {
            console.log('[v0] Authenticated with userId:', msg.userId);
            this.authenticated.next(true);
            authSub.unsubscribe();
            resolve(msg.userId);
          });
        } else {
          // Request new userId
          this.send({ type: 'requestUserId' });

          // Wait for userIdIssued
          const userIdSub = this.getMessagesOfType<any>('userIdIssued').subscribe((msg) => {
            console.log('[v0] Received userId:', msg.userId);
            userIdSub.unsubscribe();

            // Now authenticate
            this.send({ type: 'auth', userId: msg.userId });

            const authSub = this.getMessagesOfType<any>('auth_ok').subscribe((authMsg) => {
              console.log('[v0] Authenticated with new userId');
              this.authenticated.next(true);
              authSub.unsubscribe();
              resolve(msg.userId);
            });
          });
        }
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
        reject(error);
      };

      this.socket.onclose = () => {
        console.log('[v0] WebSocket disconnected');
        this.connectionStatus.next(false);
        this.authenticated.next(false);
      };
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connectionStatus.next(false);
      this.authenticated.next(false);
    }
  }

  private send(message: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      console.log('[v0] WebSocket message sent:', message);
    } else {
      console.error('[v0] WebSocket is not connected');
    }
  }

  getAllRooms(): void {
    this.send({ type: 'getAllRooms' });
  }

  getAllArchivedRooms(): void {
    this.send({ type: 'getAllArchivedRooms' });
  }

  joinRoom(roomId: number, nickname: string): void {
    this.send({ type: 'joinRoom', roomId, nickname });
  }

  archiveRoom(roomId: number): void {
    this.send({ type: 'archiveRoom', roomId });
  }

  sendMessage(roomId: number, content: string): void {
    this.send({ type: 'sendMessage', roomId, content });
  }

  createRoom(name: string, maxParticipants: number | null): void {
    this.send({ type: 'createRoom', name, maxParticipants });
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
