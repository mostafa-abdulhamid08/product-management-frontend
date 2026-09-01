import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { catchError, firstValueFrom, map, Observable, of, switchMap, tap } from 'rxjs';

import { ApiResponse } from '../models/api-response.model';
import { User } from '../models/user.model';
import { SKIP_AUTH_REDIRECT, SKIP_FORBIDDEN_REDIRECT } from '../http-context';

export interface Credentials {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly _user = signal<User | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly permissions = computed(() => this._user()?.permissions ?? []);

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  hasAny(...permissions: string[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  csrfCookie(): Observable<void> {
    return this.http.get<void>('/sanctum/csrf-cookie');
  }

  login(credentials: Credentials): Observable<User> {
    const context = new HttpContext().set(SKIP_FORBIDDEN_REDIRECT, true);

    return this.http
      .post<ApiResponse<User>>('/api/login', credentials, { context })
      .pipe(map((response) => response.data))
      .pipe(tap((user) => this._user.set(user)));
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/logout', {}).pipe(tap(() => this.clear()));
  }

  me(): Observable<User> {
    const context = new HttpContext().set(SKIP_AUTH_REDIRECT, true);

    return this.http
      .get<ApiResponse<User>>('/api/me', { context })
      .pipe(map((response) => response.data))
      .pipe(tap((user) => this._user.set(user)));
  }

  clear(): void {
    this._user.set(null);
  }

  /**
   * Runs before the first route is matched. A 401 here is the ordinary
   * signed-out case, not a failure — the guards then place the visitor on
   * /login themselves.
   */
  restoreSession(): Promise<void> {
    return firstValueFrom(
      this.csrfCookie().pipe(
        switchMap(() => this.me()),
        map(() => undefined),
        catchError(() => {
          this.clear();

          return of(undefined);
        }),
      ),
    );
  }
}
