import { Component, type OnInit } from '@angular/core';
import { randomFloatNeg1_5To1_5 } from '../utils/random';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProfileService } from '../services/profile.service';
import { UserService } from '../services/user.service';
import { WebSocketService } from '../services/websocket.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  profileSettingsForm = new FormGroup({
    username: new FormControl('', Validators.required),
  });

  wrapperDegAngle = randomFloatNeg1_5To1_5();
  avatarImage: string | null = null;
  selectedFile: File | null = null;
  userColor: string = '#' + Math.floor(Math.random() * 16777215).toString(16);
  isLoading = false;
  errorMessage = '';

  constructor(
    private profileService: ProfileService,
    private userService: UserService,
    private wsService: WebSocketService,
    private router: Router
  ) {}

  ngOnInit() {
    // Load saved username
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      this.profileSettingsForm.get('username')?.setValue(savedUsername);
    }

    // Load saved avatar
    const savedAvatar = localStorage.getItem('userAvatar');
    if (savedAvatar) {
      this.avatarImage = savedAvatar;
    }

    const savedColor = localStorage.getItem('userColor');
    if (savedColor) {
      this.userColor = savedColor;
    }
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.selectedFile = file;

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result as string;
        this.avatarImage = result;
      };
      reader.readAsDataURL(file);
    }
  }

  removeAvatar(): void {
    this.avatarImage = null;
    this.selectedFile = null;
    localStorage.removeItem('userAvatar');
  }

  async saveProfileSettings(): Promise<void> {
    const username = this.profileSettingsForm.get('username');

    if (!username?.value || username.value.trim() === '') {
      this.errorMessage = 'Username is required';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      let userId = await this.userService.getUserId();

      if (!this.wsService.isConnected$) {
        this.wsService.connect(userId);
      }

      // Wait for welcome message with userId
      await new Promise<void>((resolve) => {
        const sub = this.wsService
          .getMessagesOfType<any>('welcome')
          .subscribe((msg) => {
            userId = msg.userId;
            localStorage.setItem('userId', userId || '');
            sub.unsubscribe();
            resolve();
          });
      });

      let avatarPath = this.avatarImage || '';

      // Upload avatar if new file selected
      if (this.selectedFile && userId) {
        const uploadResponse = await this.profileService
          .uploadAvatar(userId, this.selectedFile)
          .toPromise();
        if (uploadResponse?.avatarUrl) {
          avatarPath = uploadResponse.avatarUrl;
        }
      }

      // Save profile
      if (userId) {
        await this.profileService
          .saveProfile({
            userId,
            nickname: username.value,
            color: this.userColor,
            avatarPath,
          })
          .toPromise();

        // Update local user service
        this.userService.setUser({
          userId,
          nickname: username.value,
          color: this.userColor,
          avatarUrl: avatarPath,
        });

        // Send profile via WebSocket
        this.wsService.sendProfile(username.value, this.userColor, avatarPath);

        // Navigate to rooms
        this.router.navigate(['/rooms']);
      }
    } catch (error) {
      console.error('[v0] Error saving profile:', error);
      this.errorMessage = 'Failed to save profile. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}
