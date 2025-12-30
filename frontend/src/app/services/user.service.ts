import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  userId: string;
  nickname?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const userId = localStorage.getItem('userId');
    const nickname = localStorage.getItem('nickname');

    if (userId) {
      this.currentUserSubject.next({
        userId,
        nickname: nickname || undefined,
      });
    }
  }

  setUser(user: User): void {
    localStorage.setItem('userId', user.userId);
    if (user.nickname) {
      localStorage.setItem('nickname', user.nickname);
    }
    this.currentUserSubject.next(user);
  }

  setNickname(nickname: string): void {
    const user = this.currentUserSubject.value;
    if (user) {
      user.nickname = nickname;
      localStorage.setItem('nickname', nickname);
      this.currentUserSubject.next(user);
    }
  }

  getUser(): User | null {
    return this.currentUserSubject.value;
  }

  getUserId(): string | null {
    return this.currentUserSubject.value?.userId || localStorage.getItem('userId');
  }

  getNickname(): string | null {
    return this.currentUserSubject.value?.nickname || localStorage.getItem('nickname');
  }

  isProfileComplete(): boolean {
    const user = this.currentUserSubject.value;
    return !!user && !!user.userId;
  }

  clearUser(): void {
    localStorage.removeItem('userId');
    localStorage.removeItem('nickname');
    this.currentUserSubject.next(null);
  }
}
