import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, OnInit, OnDestroy, signal, effect } from '@angular/core';
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
export class ChatWindowComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer')
  messagesContainer!: ElementRef<HTMLDivElement>;

  wrapperDegAngle = signal(randomFloat(-1.5, 1.5));
  roomTitle = signal('Chat Room');
  activeUsers = signal(0);
  messages = signal<Message[]>([]);
  showNicknameModal = signal(true);
  isShaking = signal(false);

  roomId: number | null = null;

  messageForm = new FormGroup({
    message: new FormControl('', Validators.required),
  });

  nicknameForm = new FormGroup({
    nickname: new FormControl('', Validators.required),
  });

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private wsService: WebSocketService,
    private userService: UserService
  ) {
    // 🔥 auto-scroll effect
    effect(() => {
      this.messages();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const id = params['id'];
      if (!id) return;

      this.roomId = Number(id);

      const savedNickname = this.userService.getNickname();
      if (savedNickname) {
        this.nicknameForm.get('nickname')?.setValue(savedNickname);
        this.showNicknameModal.set(false);
        this.joinRoom(savedNickname);
      }
    });

    this.subscriptions.push(
      this.wsService.getMessagesOfType<any>('roomData').subscribe((msg) => {
        if (msg.data.roomId === this.roomId) {
          this.roomTitle.set(msg.data.name);
          this.activeUsers.set(msg.data.connectedClientsAmount);
        }
      }),

      this.wsService.getMessagesOfType<any>('chatMessage').subscribe((msg) => {
        if (msg.data.roomId === this.roomId) {
          this.messages.update((list) => [
            ...list,
            {
              id: msg.data.id,
              roomId: msg.data.roomId,
              userId: msg.data.userId,
              nickname: msg.data.nickname,
              content: msg.data.content,
              sentAt: msg.data.sentAt,
            },
          ]);
        }
      }),

      this.wsService.getMessagesOfType<any>('roomDestroyed').subscribe((msg) => {
        if (msg.data.roomId === this.roomId) {
          alert('This room has been archived.');
          this.router.navigate(['/rooms']);
        }
      }),

      this.wsService.getMessagesOfType<any>('error').subscribe((msg) => {
        if (msg.code === 'ROOM_NOT_FOUND' || msg.code === 'ROOM_ARCHIVED') {
          alert(`Error: ${msg.code}`);
          this.router.navigate(['/rooms']);
        } else if (msg.code === 'NICKNAME_REQUIRED') {
          this.showNicknameModal.set(true);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  submitNickname() {
    const nickname = this.nicknameForm.get('nickname')?.value;

    if (!nickname?.trim()) return;

    this.userService.setNickname(nickname);
    this.showNicknameModal.set(false);
    this.joinRoom(nickname);
  }

  submitMessage() {
    const control = this.messageForm.get('message');
    if (!control?.value?.trim()) {
      this.triggerShake();
      return;
    }

    if (this.roomId) {
      this.wsService.sendMessage(this.roomId, control.value);
      control.setValue('');
    }
  }

  private joinRoom(nickname: string) {
    if (this.roomId) {
      this.wsService.joinRoom(this.roomId, nickname);
    }
  }

  shouldShowNickname(index: number): boolean {
    const msgs = this.messages();
    if (index === 0) return true;
    return msgs[index].userId !== msgs[index - 1].userId;
  }

  isOwnMessage(msg: Message): boolean {
    return msg.userId === this.userService.getUserId();
  }

  formatTimestamp(iso: string): string {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  private triggerShake() {
    this.isShaking.set(true);
    setTimeout(() => this.isShaking.set(false), 500);
  }

  private scrollToBottom() {
    const el = this.messagesContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
