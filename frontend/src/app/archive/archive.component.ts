import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WebSocketService } from '../services/websocket.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface ArchivedRoom {
  roomId: number;
  name: string;
  creatorUserId: string;
  createdAt: string;
}

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './archive.component.html',
  styleUrl: './archive.component.scss',
})
export class ArchiveComponent implements OnInit {
  private readonly wsService = inject(WebSocketService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly archivedRooms = signal<ArchivedRoom[]>([]);
  readonly isLoading = signal(true);

  ngOnInit(): void {
    this.wsService
      .getMessagesOfType<any>('allArchivedRooms')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        this.archivedRooms.set(msg.data.rooms);
        this.isLoading.set(false);
      });

    this.wsService.getAllArchivedRooms();
  }

  viewRoom(roomId: number) {
    // Navigate to the archived room (will be implemented when backend supports it)
    this.router.navigate(['/archive', roomId]);
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
}
