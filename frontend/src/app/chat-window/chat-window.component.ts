import { CommonModule } from '@angular/common';
import {
  Component,
  type ElementRef,
  ViewChild,
  type OnInit,
  type AfterViewChecked,
  type OnDestroy,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { randomFloat } from '../utils/random';
import type { Message } from '../models/api.models';
import type { Subscription } from 'rxjs';
import { WebSocketService } from '../services/websocket.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
})
export class ChatWindowComponent
  implements OnInit, AfterViewChecked, OnDestroy
{
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  wrapperDegAngle = randomFloat(-1.5, 1.5);
  messageForm = new FormGroup({
    message: new FormControl('', Validators.required),
  });

  defaultNameColor = '#000000';
  defaultAvatar =
    'https://t4.ftcdn.net/jpg/00/65/77/27/360_F_65772719_A1UV5kLi5nCEWI0BNLLiFaBPEkUbv5Fv.jpg';

  isShaking = false;
  roomTitle = 'Chat Room';
  activeUsers = 0;
  roomId: number | null = null;

  messages: Message[] = [];
  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;

  constructor(
    private route: ActivatedRoute,
    private wsService: WebSocketService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.roomId = Number.parseInt(id, 10);
        this.joinRoom();
      }
    });

    const historySub = this.wsService
      .getMessagesOfType<any>('history')
      .subscribe((msg) => {
        if (msg.roomId === this.roomId) {
          this.messages = msg.messages;
          this.shouldScrollToBottom = true;
        }
      });
    this.subscriptions.push(historySub);

    const messageSub = this.wsService
      .getMessagesOfType<any>('message')
      .subscribe((msg) => {
        if (msg.message.roomId === this.roomId) {
          this.messages.push(msg.message);
          this.shouldScrollToBottom = true;
        }
      });
    this.subscriptions.push(messageSub);

    const roomUpdateSub = this.wsService
      .getMessagesOfType<any>('roomUpdate')
      .subscribe((msg) => {
        if (msg.room.id === this.roomId) {
          this.roomTitle = msg.room.name;
          this.activeUsers = msg.room.currentParticipants;
        }
      });
    this.subscriptions.push(roomUpdateSub);

    setTimeout(() => {
      this.scrollToBottom();
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy() {
    if (this.roomId) {
      this.wsService.leaveRoom(this.roomId);
    }
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private joinRoom() {
    if (this.roomId) {
      this.wsService.joinRoom(this.roomId);
    }
  }

  shouldShowAvatar(index: number): boolean {
    if (index === 0) return true;
    const currentMsg = this.messages[index];
    const previousMsg = this.messages[index - 1];
    return currentMsg.userId !== previousMsg.userId;
  }

  async isOwnMessage(message: Message): Promise<boolean> {
    const currentUserId = await this.userService.getUserId();
    return message.userId === currentUserId;
  }

  formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let relativeTime = '';
    if (diffMins === 0) {
      relativeTime = 'just now';
    } else if (diffMins < 60) {
      relativeTime =
        diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      relativeTime = diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      relativeTime = diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else {
      relativeTime = date.toLocaleDateString();
    }

    const time = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateStr = date.toLocaleDateString();
    return `${dateStr} ${time} (${relativeTime})`;
  }

  private triggerShake() {
    const now = Date.now();
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
