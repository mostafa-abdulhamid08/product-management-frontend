import { computed, Injectable, signal } from '@angular/core';

import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
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

  setUser(user: User | null): void {
    this._user.set(user);
  }
}
