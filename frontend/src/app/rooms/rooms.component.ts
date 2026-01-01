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
  styleUrls: ['./rooms.component.scss'],
})
export class RoomsComponent implements OnInit, OnDestroy {
  wrapperDegAngle = signal(randomFloat(-1.5, 1.5));
  rooms = signal<Room[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  showCreateRoomModal = signal(false);

  search = signal('');

  createRoomForm = new FormGroup({
    roomName: new FormControl('', Validators.required),
    maxParticipants: new FormControl<number | null>(null),
  });

  filteredRooms = computed(() => {
    const searchValue = this.search().toLowerCase();
    if (!searchValue) return this.rooms();
    return this.rooms().filter((room) => room.name.toLowerCase().includes(searchValue));
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

    const errorSub = this.wsService.getMessagesOfType<any>('error').subscribe((msg) => {
      console.error('[v0] Error from server:', msg.code);
      this.errorMessage.set(`Error: ${msg.code}`);
    });

    this.subscriptions.push(roomsSub, roomDestroyedSub, errorSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  onSearchInput(value: string) {
    this.search.set(value);
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

    if (!roomName?.trim()) return;

    this.wsService.createRoom(roomName, maxParticipants || null);

    this.closeCreateRoomModal();
    this.search.set('');

    setTimeout(() => this.wsService.getAllRooms(), 500);
  }

  getRoomParticipants(room: Room): string {
    return room.maxClients
      ? `${room.connectedClientsAmount}/${room.maxClients}`
      : `${room.connectedClientsAmount}`;
  }

  isRoomFull(room: Room): boolean {
    if (room.maxClients === null) return false;
    return room.connectedClientsAmount >= room.maxClients;
  }

  trackByRoomId(index: number, room: Room): number {
    return room.roomId;
  }
}
