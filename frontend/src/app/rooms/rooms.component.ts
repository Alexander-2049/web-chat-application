import { CommonModule } from '@angular/common';
import { Component, type OnInit, type OnDestroy } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { randomFloat } from '../utils/random';
import { RoomService } from '../services/room.service';
import { WebSocketService } from '../services/websocket.service';
import { UserService } from '../services/user.service';
import type { Room } from '../models/api.models';
import type { Subscription } from 'rxjs';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss',
})
export class RoomsComponent implements OnInit, OnDestroy {
  wrapperDegAngle = randomFloat(-1.5, 1.5);
  headForm = new FormGroup({
    searchCreateInputBar: new FormControl('', Validators.required),
  });

  rooms: Room[] = [];
  filteredRooms: Room[] = [];
  isLoading = true;
  errorMessage = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private roomService: RoomService,
    private wsService: WebSocketService,
    private userService: UserService
  ) {}

  async ngOnInit() {
    this.loadRooms();

    const userId = await this.userService.getUserId();
    this.wsService.connect(userId);

    const roomUpdateSub = this.wsService
      .getMessagesOfType<any>('roomsListUpdate')
      .subscribe((msg) => {
        this.rooms = msg.rooms;
        this.filterRooms();
      });
    this.subscriptions.push(roomUpdateSub);

    const roomDeletedSub = this.wsService
      .getMessagesOfType<any>('roomDeleted')
      .subscribe((msg) => {
        this.rooms = this.rooms.filter((r) => r.id !== msg.roomId);
        this.filterRooms();
      });
    this.subscriptions.push(roomDeletedSub);

    const searchSub = this.headForm
      .get('searchCreateInputBar')
      ?.valueChanges.subscribe(() => {
        this.filterRooms();
      });
    if (searchSub) {
      this.subscriptions.push(searchSub);
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadRooms() {
    this.isLoading = true;
    this.roomService.getRooms().subscribe({
      next: (rooms) => {
        this.rooms = rooms;
        this.filteredRooms = rooms;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('[v0] Error loading rooms:', error);
        this.errorMessage = 'Failed to load rooms';
        this.isLoading = false;
      },
    });
  }

  private filterRooms() {
    const searchTerm =
      this.headForm.get('searchCreateInputBar')?.value?.toLowerCase() || '';
    if (searchTerm) {
      this.filteredRooms = this.rooms.filter((room) =>
        room.name.toLowerCase().includes(searchTerm)
      );
    } else {
      this.filteredRooms = this.rooms;
    }
  }

  async createRoom() {
    console.log('createRoom triggered');
    const roomName = this.headForm.get('searchCreateInputBar')?.value;
    if (!roomName || roomName.trim() === '') {
      return;
    }
    console.log('createRoom roomName: ' + roomName);

    const userId = await this.userService.getUserId();
    if (!userId) {
      this.errorMessage = 'User not found';
      return;
    }

    console.log('createRoom userId: ' + userId);
    this.roomService
      .createRoom({
        name: roomName,
        isPrivate: false,
        maxParticipants: 10,
        creatorUserId: userId,
      })
      .subscribe({
        next: (room) => {
          this.rooms.push(room);
          this.filterRooms();
          this.headForm.get('searchCreateInputBar')?.setValue('');
        },
        error: (error) => {
          console.error('[v0] Error creating room:', error);
          this.errorMessage = 'Failed to create room';
        },
      });
  }

  getRoomParticipants(room: Room): string {
    if (room.maxParticipants) {
      return `${room.currentParticipants}/${room.maxParticipants}`;
    }
    return `${room.currentParticipants}`;
  }
}
