import { Routes } from '@angular/router';

import { adminGuard } from './core/guards/admin.guard';
import { catalogGuard } from './core/guards/catalog.guard';
import { guestGuard } from './core/guards/guest.guard';

const placeholder = () =>
  import('./shared/components/placeholder-page/placeholder-page.component').then(
    (m) => m.PlaceholderPageComponent,
  );

const catalogChildren: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', loadComponent: placeholder, data: { title: 'Dashboard' } },
];

const adminChildren: Routes = [...catalogChildren];

export const routes: Routes = [
  { path: 'login', canMatch: [guestGuard], loadComponent: placeholder, data: { title: 'Login' } },
  { path: '403', loadComponent: placeholder, data: { title: 'Forbidden' } },

  {
    path: '',
    canMatch: [adminGuard],
    loadComponent: () =>
      import('./layout/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: adminChildren,
  },

  {
    path: '',
    canMatch: [catalogGuard],
    loadComponent: () =>
      import('./layout/catalog-layout/catalog-layout.component').then(
        (m) => m.CatalogLayoutComponent,
      ),
    children: [
      ...catalogChildren,
      { path: '**', loadComponent: placeholder, data: { title: 'Forbidden' } },
    ],
  },

  { path: '**', loadComponent: placeholder, data: { title: 'Not found' } },
];
