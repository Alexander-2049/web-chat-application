import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  HostListener,
  signal,
  effect,
  computed,
  DestroyRef,
  inject,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { randomFloat } from '../utils/random';
import { Message } from '../models/api.models';
import { WebSocketService } from '../services/websocket.service';
import { UserService } from '../services/user.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent implements OnInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  readonly wrapperDegAngle = signal(randomFloat(-1.5, 1.5));
  readonly roomTitle = signal('Chat Room');
  readonly activeUsers = signal(0);
  readonly messages = signal<Message[]>([]);
  readonly showJoinModal = signal(false);
  readonly showNicknameModal = signal(false);
  readonly isShaking = signal(false);
  readonly roomData = signal<any>(null);
  readonly connectedClients = signal<{ id: string; nickname: string }[]>([]);
  readonly isWideScreen = signal(window.innerWidth > 1400);

  readonly nicknameForm = new FormGroup({
    nickname: new FormControl('', Validators.required),
  });

  readonly messageForm = new FormGroup({
    message: new FormControl('', Validators.required),
  });

  roomId: number | null = null;
  private isDirectNavigation = false;

  public readonly userService = inject(UserService);
  private readonly wsService = inject(WebSocketService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isRoomCreator = computed(() => {
    const data = this.roomData();
    return data ? data.creatorUserId === this.userService.getUserId() : false;
  });

  constructor() {
    effect(() => {
      this.messages();
      queueMicrotask(() => this.scrollToBottom());
    });

    const navigation = this.router.getCurrentNavigation();
    this.isDirectNavigation = !navigation?.previousNavigation;
  }

  @HostListener('window:resize')
  onResize() {
    this.isWideScreen.set(window.innerWidth > 1400);
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params['id'];
      if (!id) return;

      this.roomId = Number(id);

      const savedNickname = this.userService.getNickname();
      const savedUserId = this.userService.getUserId();

      if (!savedNickname || !savedUserId) {
        // No credentials - show nickname form first
        this.showNicknameModal.set(true);
        this.showJoinModal.set(false);
      } else if (this.isDirectNavigation) {
        // Direct URL access with credentials - show join confirmation popup
        this.nicknameForm.get('nickname')?.setValue(savedNickname);
        this.showNicknameModal.set(false);
        this.showJoinModal.set(true);
      } else {
        // Clicked from rooms list - join immediately
        this.nicknameForm.get('nickname')?.setValue(savedNickname);
        this.showNicknameModal.set(false);
        this.showJoinModal.set(false);
        this.joinRoom(savedNickname);
      }
    });

    this.registerWebSocketListeners();
  }

  private registerWebSocketListeners() {
    this.wsService
      .getMessagesOfType<any>('roomData')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg.data.roomId === this.roomId) {
          this.roomData.set(msg.data);
          this.roomTitle.set(msg.data.name);
          this.activeUsers.set(msg.data.connectedClientsAmount);
        }
      });

    this.wsService
      .getMessagesOfType<any>('roomConnectedClients')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg.data.roomId === this.roomId) {
          this.connectedClients.set(msg.data.clients);
        }
      });

    this.wsService
      .getMessagesOfType<any>('chatMessage')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
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
      });

    this.wsService
      .getMessagesOfType<any>('roomDestroyed')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg.data.roomId === this.roomId) {
          alert('This room has been archived.');
          this.router.navigate(['/rooms']);
        }
      });

    this.wsService
      .getMessagesOfType<any>('error')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg.code === 'ROOM_NOT_FOUND' || msg.code === 'ROOM_ARCHIVED') {
          alert(`Error: ${msg.code}`);
          this.router.navigate(['/rooms']);
        } else if (msg.code === 'NICKNAME_REQUIRED') {
          this.showNicknameModal.set(true);
        }
      });
  }

  joinChatFromModal() {
    const nickname = this.nicknameForm.get('nickname')?.value;
    if (!nickname?.trim()) return;

    this.showJoinModal.set(false);
    this.joinRoom(nickname);
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

  goToRoomsList() {
    this.router.navigate(['/rooms']);
  }

  archiveRoom() {
    if (!this.roomId) return;
    if (confirm('Are you sure you want to archive this room?')) {
      this.wsService.archiveRoom(this.roomId);
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

  private joinRoom(nickname: string) {
    if (this.roomId) this.wsService.joinRoom(this.roomId, nickname);
  }
}
