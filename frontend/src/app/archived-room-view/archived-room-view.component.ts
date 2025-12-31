import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-archived-room-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './archived-room-view.component.html',
  styleUrl: './archived-room-view.component.scss',
})
export class ArchivedRoomViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly roomId = signal<number | null>(null);

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.roomId.set(Number(id));
        // TODO: When backend supports viewing archived rooms, make a request here
        // this.wsService.getArchivedRoomMessages(Number(id));
      }
    });
  }

  goBack() {
    this.router.navigate(['/archive']);
  }
}
