import { Component, OnInit, OnDestroy } from "@angular/core";
import { Router, RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { HeaderComponent } from "./header/header.component";
import { WebSocketService } from "./services/websocket.service";
import { UserService } from "./services/user.service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, CommonModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent implements OnInit, OnDestroy {
  title = "chat-ng";

  isConnecting = true;
  isConnected = false;
  connectionError = "";
  private subscriptions: Subscription[] = [];

  constructor(
    private wsService: WebSocketService,
    private userService: UserService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      let userId = this.userService.getUserId();

      if (!userId) {
        userId = await this.wsService.connect();
        this.userService.setUser({ userId });
      } else {
        await this.wsService.connect(userId);
      }

      this.isConnecting = false;
      this.isConnected = true;

      // Navigate to rooms list after connection
      this.router.navigate(["/rooms"]);
    } catch (error) {
      console.error("[v0] Failed to connect to WebSocket:", error);
      this.isConnecting = false;
      this.connectionError =
        "Failed to connect to server. Please refresh the page.";
    }

    const connSub = this.wsService.isConnected$.subscribe((connected) => {
      this.isConnected = connected;
      if (!connected && !this.isConnecting) {
        this.connectionError = "Connection lost. Please refresh the page.";
      }
    });
    this.subscriptions.push(connSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.wsService.disconnect();
  }
}
