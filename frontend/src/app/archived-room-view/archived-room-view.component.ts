import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from '../services/websocket.service';

interface ArchivedMessage {
  id: number;
  userId: string;
  nickname: string;
  content: string;
  sentAt: string;
}

interface ArchivedRoomData {
  roomId: number;
  name: string;
  creatorUserId: string;
  createdAt: string;
  archived: true;
}

@Component({
  selector: 'app-archived-room-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './archived-room-view.component.html',
  styleUrl: './archived-room-view.component.scss',
})
export class ArchivedRoomViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly wsService = inject(WebSocketService);

  readonly roomId = signal<number | null>(null);
  readonly roomData = signal<ArchivedRoomData | null>(null);
  readonly messages = signal<ArchivedMessage[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.roomId.set(Number(id));
        this.wsService.getArchivedRoom(Number(id));
      }
    });

    this.wsService
      .getMessagesOfType<any>('archivedRoomData')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg.data.room.roomId === this.roomId()) {
          this.roomData.set(msg.data.room);
          this.messages.set(msg.data.messages);
          this.isLoading.set(false);
        }
      });

    this.wsService
      .getMessagesOfType<any>('error')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg.code === 'ROOM_NOT_FOUND') {
          this.errorMessage.set('Room not found');
          this.isLoading.set(false);
        } else if (msg.code === 'ROOM_NOT_ARCHIVED') {
          this.errorMessage.set('This room is not archived');
          this.isLoading.set(false);
        } else if (msg.code === 'INVALID_ROOM_ID') {
          this.errorMessage.set('Invalid room ID');
          this.isLoading.set(false);
        }
      });
  }

  goBack() {
    this.router.navigate(['/archive']);
  }

  formatTimestamp(iso: string): string {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  shouldShowNickname(index: number): boolean {
    const msgs = this.messages();
    if (index === 0) return true;
    return msgs[index].userId !== msgs[index - 1].userId;
  }
}
