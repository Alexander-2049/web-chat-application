import { Routes } from '@angular/router';
import { RoomsComponent } from './rooms/rooms.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';

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
    path: '',
    redirectTo: 'rooms',
    pathMatch: 'full',
  },
];
