import type { Routes } from '@angular/router';
import { RoomsComponent } from './rooms/rooms.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';
import { ArchiveComponent } from './archive/archive.component';
import { ArchivedRoomViewComponent } from './archived-room-view/archived-room-view.component';

export const routes: Routes = [
  {
    path: 'rooms',
    component: RoomsComponent,
  },
  {
    path: 'rooms/:id',
    component: ChatWindowComponent,
  },
  {
    path: 'archive',
    component: ArchiveComponent,
  },
  {
    path: 'archive/:id',
    component: ArchivedRoomViewComponent,
  },
  {
    path: '',
    redirectTo: 'rooms',
    pathMatch: 'full',
  },
];
