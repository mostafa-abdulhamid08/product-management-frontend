import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';

import { AuthService } from '../services/auth.service';

/**
 * Hides a control the user has no permission for. UX only — the backend is what
 * forbids. Accepts one permission or several, in which case holding any one of
 * them is enough, matching the OR-gated endpoints.
 *
 *   <button *hasPermission="'products.create'">Add product</button>
 *   <a *hasPermission="['roles.view', 'users.view']">Administration</a>
 */
@Directive({
  selector: '[hasPermission]',
})
export class HasPermissionDirective {
  private readonly auth = inject(AuthService);
  private readonly template = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly container = inject(ViewContainerRef);

  readonly hasPermission = input.required<string | string[]>();

  private visible = false;

  constructor() {
    effect(() => {
      const required = this.hasPermission();
      const allowed = Array.isArray(required)
        ? this.auth.hasAny(...required)
        : this.auth.hasPermission(required);

      if (allowed === this.visible) {
        return;
      }

      this.visible = allowed;

      if (allowed) {
        this.container.createEmbeddedView(this.template);
      } else {
        this.container.clear();
      }
    });
  }
}
