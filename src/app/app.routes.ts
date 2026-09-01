import { Routes } from '@angular/router';

import { adminGuard } from './core/guards/admin.guard';
import { catalogGuard } from './core/guards/catalog.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';

const placeholder = () =>
  import('./shared/components/placeholder-page/placeholder-page.component').then(
    (m) => m.PlaceholderPageComponent,
  );

const catalogChildren: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', loadComponent: placeholder, data: { title: 'Dashboard' } },

  {
    path: 'products',
    canMatch: [permissionGuard],
    data: { permission: 'products.view' },
    loadComponent: () =>
      import('./features/products/pages/product-list/product-list.component').then(
        (m) => m.ProductListComponent,
      ),
  },
  // Literal before the wildcard, or `create` arrives at the details page as an id.
  {
    path: 'products/create',
    canMatch: [permissionGuard],
    data: { permission: 'products.create' },
    loadComponent: () =>
      import('./features/products/pages/product-form/product-form.component').then(
        (m) => m.ProductFormComponent,
      ),
  },
  {
    path: 'products/:id/edit',
    canMatch: [permissionGuard],
    data: { permission: 'products.update' },
    loadComponent: () =>
      import('./features/products/pages/product-form/product-form.component').then(
        (m) => m.ProductFormComponent,
      ),
  },
  {
    path: 'products/:id',
    canMatch: [permissionGuard],
    data: { permission: 'products.view' },
    loadComponent: () =>
      import('./features/products/pages/product-details/product-details.component').then(
        (m) => m.ProductDetailsComponent,
      ),
  },
];

const adminChildren: Routes = [...catalogChildren];

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
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
