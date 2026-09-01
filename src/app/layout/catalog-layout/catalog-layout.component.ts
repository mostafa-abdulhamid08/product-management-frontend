import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SidebarComponent } from '../sidebar/sidebar.component';
import { CATALOG_NAV_ITEMS } from '../sidebar/nav-items';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-catalog-layout',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './catalog-layout.component.html',
})
export class CatalogLayoutComponent {
  readonly navItems = CATALOG_NAV_ITEMS;
}
