import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminUser {
  id: string;
  username: string;
}

export interface AuthResponse {
  authenticated: true;
  user: AdminUser;
  expiresAt?: string;
}

export interface LogoutResponse {
  authenticated: false;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/auth';

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/login`,
      { username, password },
      { withCredentials: true },
    );
  }

  me(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(
      `${this.apiUrl}/me`,
      { withCredentials: true },
    );
  }

  logout(): Observable<LogoutResponse> {
    return this.http.post<LogoutResponse>(
      `${this.apiUrl}/logout`,
      {},
      { withCredentials: true },
    );
  }
}
