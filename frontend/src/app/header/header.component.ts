import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../services/user.service';
import { WebSocketService } from '../services/websocket.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {
  constructor(private userService: UserService, private wsService: WebSocketService) {}

  isUserConnected = signal(false);
  currentNickname = signal('');
  showSettingsModal = signal(false);

  imagesLoaded = signal<Record<string, boolean>>({});

  settingsForm = new FormGroup({
    nickname: new FormControl('', Validators.required),
  });

  links: {
    title: string;
    path: string;
    icon: string;
  }[] = [
    {
      title: 'Rooms',
      path: 'rooms',
      icon: 'assets/open-door-icon.png',
    },
    {
      title: 'Archive',
      path: 'archive',
      icon: 'assets/archive-icon.jpg',
    },
  ];

  ngOnInit() {
    this.isUserConnected.set(!!this.userService.getUserId());
    this.currentNickname.set(this.userService.getNickname() || '');

    // init imagesLoaded
    const loadedMap: Record<string, boolean> = {};
    this.links.forEach((link) => {
      loadedMap[link.icon] = false;
    });
    this.imagesLoaded.set(loadedMap);

    this.wsService.isConnected$.subscribe((connected) => {
      this.isUserConnected.set(connected);
    });
  }

  onImageLoad(icon: string) {
    this.imagesLoaded.update((map) => ({
      ...map,
      [icon]: true,
    }));
  }

  openSettingsModal() {
    this.settingsForm.get('nickname')?.setValue(this.currentNickname());

    this.showSettingsModal.set(true);
  }

  closeSettingsModal() {
    this.showSettingsModal.set(false);
    this.settingsForm.reset();
  }

  saveSettings() {
    const nickname = this.settingsForm.get('nickname')?.value;

    if (!nickname?.trim()) {
      return;
    }

    this.userService.setNickname(nickname);
    this.currentNickname.set(nickname);
    this.closeSettingsModal();
  }
}
