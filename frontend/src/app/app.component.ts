import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './header/header.component';
import { WebSocketService } from './services/websocket.service';
import { UserService } from './services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'chat-ng';

  isConnecting = signal(true);
  isConnected = signal(false);
  connectionError = signal('');

  private subscriptions: Subscription[] = [];
  private initialUrl = '';

  constructor(
    private wsService: WebSocketService,
    private userService: UserService,
    private router: Router
  ) {
    this.initialUrl = this.router.url;
  }

  async ngOnInit() {
    try {
      let userId = this.userService.getUserId();

      if (!userId) {
        userId = await this.wsService.connect();
        this.userService.setUser({ userId });
      } else {
        await this.wsService.connect(userId);
      }

      this.isConnecting.set(false);
      this.isConnected.set(true);

      const currentPath = window.location.pathname;
      if (currentPath === '/' || currentPath === '') {
        this.router.navigate(['/rooms']);
      }
    } catch (error) {
      console.error('[v0] Failed to connect to WebSocket:', error);

      this.isConnecting.set(false);
      this.connectionError.set('Failed to connect to server. Please refresh the page.');
    }

    const connSub = this.wsService.isConnected$.subscribe((connected) => {
      this.isConnected.set(connected);

      if (!connected && !this.isConnecting()) {
        this.connectionError.set('Connection lost. Please refresh the page.');
      }
    });

    this.subscriptions.push(connSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.wsService.disconnect();
  }
}
