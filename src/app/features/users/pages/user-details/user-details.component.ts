import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { UserRecord } from '../../models/user-record.model';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-details',
  imports: [
    DatePipe,
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
  ],
  templateUrl: './user-details.component.html',
})
export class UserDetailsComponent implements OnInit {
  private readonly users = inject(UserService);

  readonly id = input<string | undefined>(undefined);

  readonly user = signal<UserRecord | null>(null);
  readonly loading = signal(true);
  readonly missing = signal(false);
  readonly failed = signal(false);

  readonly userId = computed(() => {
    const parsed = Number(this.id());

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.userId();

    if (id === null) {
      this.missing.set(true);
      this.loading.set(false);

      return;
    }

    this.loading.set(true);
    this.missing.set(false);
    this.failed.set(false);

    this.users.getById(id).subscribe({
      next: (user) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: (error: { status?: number }) => {
        this.missing.set(error.status === 404);
        this.failed.set(error.status !== 404);
        this.loading.set(false);
      },
    });
  }
}
