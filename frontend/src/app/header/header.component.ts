import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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

  isUserConnected = false;
  currentNickname = '';
  imagesLoaded: { [key: string]: boolean } = {};

  showSettingsModal = false;
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
  ];

  ngOnInit() {
    this.isUserConnected = !!this.userService.getUserId();
    this.currentNickname = this.userService.getNickname() || '';

    this.links.forEach((link) => {
      this.imagesLoaded[link.icon] = false;
    });

    this.wsService.isConnected$.subscribe((connected) => {
      this.isUserConnected = connected;
    });
  }

  onImageLoad(icon: string) {
    this.imagesLoaded[icon] = true;
  }

  openSettingsModal() {
    this.settingsForm.get('nickname')?.setValue(this.currentNickname);
    this.showSettingsModal = true;
  }

  closeSettingsModal() {
    this.showSettingsModal = false;
    this.settingsForm.reset();
  }

  saveSettings() {
    const nickname = this.settingsForm.get('nickname')?.value;
    if (!nickname || nickname.trim() === '') {
      return;
    }

    this.userService.setNickname(nickname);
    this.currentNickname = nickname;
    this.closeSettingsModal();
  }
}
