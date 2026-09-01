import { Component, input } from '@angular/core';

/**
 * Temporary. Stands in for screens that arrive in later build steps so the
 * routing skeleton is navigable. Delete once every route has its real component.
 */
@Component({
  selector: 'app-placeholder-page',
  templateUrl: './placeholder-page.component.html',
})
export class PlaceholderPageComponent {
  readonly title = input('');
}
