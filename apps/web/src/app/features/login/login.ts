import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';

  readonly loading = signal(false);
  readonly error = signal('');

  submit(): void {
    if (this.loading()) return;

    this.error.set('');

    if (!this.username.trim() || !this.password) {
      this.error.set('Veuillez renseigner vos identifiants.');
      return;
    }

    this.loading.set(true);

    this.auth
      .login(this.username, this.password)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.password = '';
          void this.router.navigateByUrl('/dashboard');
        },
        error: (error: HttpErrorResponse) => {
          this.password = '';

          if (error.status === 401) {
            this.error.set('Identifiant ou mot de passe incorrect.');
          } else if (error.status === 429) {
            this.error.set('Trop de tentatives. Réessayez plus tard.');
          } else {
            this.error.set(
              'Connexion impossible. Vérifiez que le serveur est disponible.',
            );
          }
        },
      });
  }
}
