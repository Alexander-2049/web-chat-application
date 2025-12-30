import { CommonModule } from '@angular/common';
import {
  Component,
  type ElementRef,
  ViewChild,
  type OnInit,
  type AfterViewChecked,
  type OnDestroy,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { randomFloat } from '../utils/random';
import { Message } from '../models/api.models';
import { Subscription } from 'rxjs';
import { WebSocketService } from '../services/websocket.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
})
export class ChatWindowComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  wrapperDegAngle = randomFloat(-1.5, 1.5);
  messageForm = new FormGroup({
    message: new FormControl('', Validators.required),
  });

  isShaking = false;
  roomTitle = 'Chat Room';
  activeUsers = 0;
  roomId: number | null = null;
  roomClients: { id: string; nickname: string }[] = [];

  messages: Message[] = [];
  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;

  showNicknameModal = true;
  nicknameForm = new FormGroup({
    nickname: new FormControl('', Validators.required),
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private wsService: WebSocketService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.roomId = Number.parseInt(id, 10);

        // Check if user has a nickname
        const savedNickname = this.userService.getNickname();
        if (savedNickname) {
          this.nicknameForm.get('nickname')?.setValue(savedNickname);
          this.showNicknameModal = false;
          this.joinRoom(savedNickname);
        }
      }
    });

    const roomDataSub = this.wsService.getMessagesOfType<any>('roomData').subscribe((msg) => {
      if (msg.data.roomId === this.roomId) {
        this.roomTitle = msg.data.name;
        this.activeUsers = msg.data.connectedClientsAmount;
      }
    });
    this.subscriptions.push(roomDataSub);

    const clientsSub = this.wsService
      .getMessagesOfType<any>('roomConnectedClients')
      .subscribe((msg) => {
        if (msg.data.roomId === this.roomId) {
          this.roomClients = msg.data.clients;
        }
      });
    this.subscriptions.push(clientsSub);

    const messageSub = this.wsService.getMessagesOfType<any>('chatMessage').subscribe((msg) => {
      if (msg.data.roomId === this.roomId) {
        this.messages.push({
          id: msg.data.id,
          roomId: msg.data.roomId,
          userId: msg.data.userId,
          nickname: msg.data.nickname,
          content: msg.data.content,
          sentAt: msg.data.sentAt,
        });
        this.shouldScrollToBottom = true;
      }
    });
    this.subscriptions.push(messageSub);

    const destroyedSub = this.wsService.getMessagesOfType<any>('roomDestroyed').subscribe((msg) => {
      if (msg.data.roomId === this.roomId) {
        alert('This room has been archived.');
        this.router.navigate(['/rooms']);
      }
    });
    this.subscriptions.push(destroyedSub);

    const errorSub = this.wsService.getMessagesOfType<any>('error').subscribe((msg) => {
      console.error('[v0] Error from server:', msg.code);
      if (msg.code === 'ROOM_NOT_FOUND' || msg.code === 'ROOM_ARCHIVED') {
        alert(`Error: ${msg.code}`);
        this.router.navigate(['/rooms']);
      } else if (msg.code === 'NICKNAME_REQUIRED') {
        this.showNicknameModal = true;
      }
    });
    this.subscriptions.push(errorSub);
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  submitNickname() {
    const nickname = this.nicknameForm.get('nickname')?.value;
    if (!nickname || nickname.trim() === '') {
      return;
    }

    this.userService.setNickname(nickname);
    this.joinRoom(nickname);
    this.showNicknameModal = false;
  }

  private joinRoom(nickname: string) {
    if (this.roomId) {
      console.log('[v0] Joining room', this.roomId, 'with nickname', nickname);
      this.wsService.joinRoom(this.roomId, nickname);
    }
  }

  shouldShowNickname(index: number): boolean {
    if (index === 0) return true;
    const currentMsg = this.messages[index];
    const previousMsg = this.messages[index - 1];
    return currentMsg.userId !== previousMsg.userId;
  }

  isOwnMessage(message: Message): boolean {
    const currentUserId = this.userService.getUserId();
    return message.userId === currentUserId;
  }

  formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private triggerShake() {
    if (this.isShaking) {
      this.isShaking = false;
      setTimeout(() => {
        this.isShaking = true;
      }, 10);
    } else {
      this.isShaking = true;
    }

    setTimeout(() => {
      this.isShaking = false;
    }, 500);
  }

  submitMessage() {
    const message = this.messageForm.get('message');
    if (message === null || message.value === null) return;
    if (message.hasError('required') || message.value.trim() === '') {
      this.triggerShake();
      return;
    }

    if (this.roomId) {
      this.wsService.sendMessage(this.roomId, message.value);
      message.setValue('');
    }

    setTimeout(() => {
      this.scrollToBottom();
    }, 0);
  }

  private scrollToBottom() {
    if (!this.messagesContainer) return;

    try {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
