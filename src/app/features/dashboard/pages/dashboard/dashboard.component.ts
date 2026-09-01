import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { PricePipe } from '../../../../shared/pipes/price.pipe';
import { DashboardStats, RecentProduct, toCards } from '../../models/dashboard.model';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    PricePipe,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);

  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  /**
   * Built from the keys the API returned, not from a hardcoded list. Add a
   * resource to the backend and it appears here with no frontend change.
   */
  readonly cards = computed(() => toCards(this.stats() ?? {}));
  readonly recent = computed<RecentProduct[]>(() => this.stats()?.recent_products ?? []);
  readonly hasRecent = computed(() => this.recent().length > 0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.dashboard.get().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: () => {
        this.stats.set(null);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}
