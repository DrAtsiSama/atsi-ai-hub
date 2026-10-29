import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loggingOut = signal(false);
  readonly error = signal('');

  logout(): void {
    if (this.loggingOut()) return;

    this.loggingOut.set(true);
    this.error.set('');

    this.auth
      .logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/');
        },
        error: () => {
          this.error.set(
            'Déconnexion impossible. Veuillez réessayer.',
          );
        },
      });
  }
}
