import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { ChatWindowComponent } from './chat-window.component';
import { WebSocketService } from '../services/websocket.service';
import { UserService } from '../services/user.service';

class MockWebSocketService {
  getMessagesOfType = <T>() => new Subject<T>().asObservable();
  leaveRoom = () => undefined;
  joinRoom = () => undefined;
  archiveRoom = () => undefined;
  sendMessage = () => undefined;
}

class MockUserService {
  getNickname = () => null;
  getUserId = () => null;
  setNickname = () => undefined;
}

class MockRouter {
  events = new Subject();
  getCurrentNavigation = () => null;
  navigate = () => Promise.resolve(true);
}

describe('ChatWindowComponent', () => {
  let component: ChatWindowComponent;
  let fixture: ComponentFixture<ChatWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatWindowComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { params: of({ id: '1' }) } },
        { provide: WebSocketService, useClass: MockWebSocketService },
        { provide: UserService, useClass: MockUserService },
        { provide: Router, useClass: MockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
