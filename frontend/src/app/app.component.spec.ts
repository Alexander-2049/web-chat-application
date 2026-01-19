import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { AppComponent } from './app.component';
import { WebSocketService } from './services/websocket.service';
import { UserService } from './services/user.service';

class MockWebSocketService {
  private connectionStatus = new BehaviorSubject<boolean>(false);
  isConnected$ = this.connectionStatus.asObservable();

  connect = async (_userId?: string) => 'mock-user-id';
  disconnect = () => undefined;
  getMessagesOfType = <T>() => new Subject<T>().asObservable();
}

class MockUserService {
  getUserId = () => null;
  setUser = () => undefined;
}

class MockRouter {
  url = '/';
  navigate = () => Promise.resolve(true);
}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: WebSocketService, useClass: MockWebSocketService },
        { provide: UserService, useClass: MockUserService },
        { provide: Router, useClass: MockRouter },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'chat-ng' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('chat-ng');
  });

  it('should render the connection screen initially', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('Connecting to server');
  });
});
