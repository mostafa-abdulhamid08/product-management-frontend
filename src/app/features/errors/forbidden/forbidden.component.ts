import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Renders in two places: bare at /403 after a permissionGuard redirect, and
 * inside the catalog shell as its catch-all child. It must not assume a
 * full-page canvas.
 */
@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  templateUrl: './forbidden.component.html',
})
export class ForbiddenComponent {}
