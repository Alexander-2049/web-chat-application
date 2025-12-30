import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { randomFloat } from '../utils/random';
import { WebSocketService } from '../services/websocket.service';
import { UserService } from '../services/user.service';
import { Room } from '../models/api.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss',
})
export class RoomsComponent implements OnInit, OnDestroy {
  // 🔥 signals
  wrapperDegAngle = signal(randomFloat(-1.5, 1.5));
  rooms = signal<Room[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  showCreateRoomModal = signal(false);

  searchForm = new FormGroup({
    search: new FormControl(''),
  });

  createRoomForm = new FormGroup({
    roomName: new FormControl('', Validators.required),
    maxParticipants: new FormControl<number | null>(null),
  });

  // 🔥 computed rooms list
  filteredRooms = computed(() => {
    const search = this.searchForm.get('search')?.value?.toLowerCase() || '';

    if (!search) {
      return this.rooms();
    }

    return this.rooms().filter((room) => room.name.toLowerCase().includes(search));
  });

  private subscriptions: Subscription[] = [];

  constructor(private wsService: WebSocketService, private userService: UserService) {}

  ngOnInit() {
    this.wsService.getAllRooms();

    const roomsSub = this.wsService.getMessagesOfType<any>('allActiveRooms').subscribe((msg) => {
      this.rooms.set(msg.data.rooms);
      this.isLoading.set(false);
    });

    const roomDestroyedSub = this.wsService
      .getMessagesOfType<any>('roomDestroyed')
      .subscribe((msg) => {
        this.rooms.update((rooms) => rooms.filter((r) => r.roomId !== msg.data.roomId));
      });

    const searchSub = this.searchForm.get('search')?.valueChanges.subscribe(() => {
      /* computed сам пересчитается */
    });

    const errorSub = this.wsService.getMessagesOfType<any>('error').subscribe((msg) => {
      console.error('[v0] Error from server:', msg.code);
      this.errorMessage.set(`Error: ${msg.code}`);
    });

    this.subscriptions.push(
      roomsSub,
      roomDestroyedSub,
      ...(searchSub ? [searchSub] : []),
      errorSub
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  openCreateRoomModal() {
    this.showCreateRoomModal.set(true);
    setTimeout(() => {
      const input = document.getElementById('roomNameInput') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  }

  closeCreateRoomModal() {
    this.showCreateRoomModal.set(false);
    this.createRoomForm.reset();
  }

  createRoom() {
    const roomName = this.createRoomForm.get('roomName')?.value;
    const maxParticipants = this.createRoomForm.get('maxParticipants')?.value;

    if (!roomName?.trim()) {
      return;
    }

    this.wsService.createRoom(roomName, maxParticipants || null);

    this.closeCreateRoomModal();
    this.searchForm.get('search')?.setValue('');

    setTimeout(() => this.wsService.getAllRooms(), 500);
  }

  getRoomParticipants(room: Room): string {
    return room.maxClients
      ? `${room.connectedClientsAmount}/${room.maxClients}`
      : `${room.connectedClientsAmount}`;
  }
}
