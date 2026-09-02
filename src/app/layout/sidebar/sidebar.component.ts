import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { AuthService } from '../../core/services/auth.service';
import { NavItem } from './nav-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);

  readonly items = input.required<NavItem[]>();

  /**
   * The shell decides which section of the app exists for this user; this
   * decides which links inside it are reachable. Both filters are needed —
   * a product-manager and a viewer share the catalog shell and see the same
   * three links, but a user without `categories.view` sees two.
   */
  readonly visibleItems = computed(() =>
    this.items().filter(
      (item) => item.permission === null || this.auth.hasPermission(item.permission),
    ),
  );
}
