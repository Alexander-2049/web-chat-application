import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { RouterLink } from "@angular/router";
import { randomFloat } from "../utils/random";
import { WebSocketService } from "../services/websocket.service";
import { UserService } from "../services/user.service";
import { Room } from "../models/api.models";
import { Subscription } from "rxjs";

@Component({
  selector: "app-rooms",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./rooms.component.html",
  styleUrl: "./rooms.component.scss",
})
export class RoomsComponent implements OnInit, OnDestroy {
  wrapperDegAngle = randomFloat(-1.5, 1.5);
  headForm = new FormGroup({
    searchCreateInputBar: new FormControl("", Validators.required),
  });

  rooms: Room[] = [];
  filteredRooms: Room[] = [];
  isLoading = true;
  errorMessage = "";
  private subscriptions: Subscription[] = [];

  showCreateRoomModal = false;
  createRoomForm = new FormGroup({
    roomName: new FormControl("", Validators.required),
    maxParticipants: new FormControl<number | null>(null),
  });

  constructor(
    private wsService: WebSocketService,
    private userService: UserService
  ) {}

  async ngOnInit() {
    // Request all rooms
    this.wsService.getAllRooms();

    const roomsSub = this.wsService
      .getMessagesOfType<any>("allActiveRooms")
      .subscribe((msg) => {
        console.log("[v0] Received rooms:", msg.data.rooms);
        this.rooms = msg.data.rooms;
        this.filterRooms();
        this.isLoading = false;
      });
    this.subscriptions.push(roomsSub);

    const roomDestroyedSub = this.wsService
      .getMessagesOfType<any>("roomDestroyed")
      .subscribe((msg) => {
        this.rooms = this.rooms.filter((r) => r.roomId !== msg.data.roomId);
        this.filterRooms();
      });
    this.subscriptions.push(roomDestroyedSub);

    const searchSub = this.headForm
      .get("searchCreateInputBar")
      ?.valueChanges.subscribe(() => {
        this.filterRooms();
      });
    if (searchSub) {
      this.subscriptions.push(searchSub);
    }

    const errorSub = this.wsService
      .getMessagesOfType<any>("error")
      .subscribe((msg) => {
        console.error("[v0] Error from server:", msg.code);
        this.errorMessage = `Error: ${msg.code}`;
      });
    this.subscriptions.push(errorSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private filterRooms() {
    const searchTerm =
      this.headForm.get("searchCreateInputBar")?.value?.toLowerCase() || "";
    if (searchTerm) {
      this.filteredRooms = this.rooms.filter((room) =>
        room.name.toLowerCase().includes(searchTerm)
      );
    } else {
      this.filteredRooms = this.rooms;
    }
  }

  openCreateRoomModal() {
    const roomName = this.headForm.get("searchCreateInputBar")?.value;
    if (roomName && roomName.trim() !== "") {
      this.createRoomForm.get("roomName")?.setValue(roomName);
    }
    this.showCreateRoomModal = true;
  }

  closeCreateRoomModal() {
    this.showCreateRoomModal = false;
    this.createRoomForm.reset();
  }

  createRoom() {
    const roomName = this.createRoomForm.get("roomName")?.value;
    const maxParticipants = this.createRoomForm.get("maxParticipants")?.value;

    if (!roomName || roomName.trim() === "") {
      return;
    }

    console.log("[v0] Creating room:", roomName, maxParticipants);
    this.wsService.createRoom(roomName, maxParticipants || null);

    this.closeCreateRoomModal();
    this.headForm.get("searchCreateInputBar")?.setValue("");

    // Refresh rooms list
    setTimeout(() => {
      this.wsService.getAllRooms();
    }, 500);
  }

  getRoomParticipants(room: Room): string {
    if (room.maxClients) {
      return `${room.connectedClientsAmount}/${room.maxClients}`;
    }
    return `${room.connectedClientsAmount}`;
  }
}
