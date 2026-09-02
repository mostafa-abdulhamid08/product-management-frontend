import { computed, inject, Injectable, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

/**
 * One bar, two triggers: router navigation (so it covers a lazy chunk
 * downloading) and in-flight HTTP.
 *
 * HTTP is counted, not flagged. With a boolean, two concurrent requests would
 * hide the bar the moment the first one finished while the second was still
 * running.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly inFlight = signal(0);
  private readonly navigating = signal(false);
  private readonly delayed = signal(false);

  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly busy = computed(() => this.inFlight() > 0 || this.navigating());

  /** Busy *and* past the delay, so a fast response never flashes the bar. */
  readonly visible = computed(() => this.busy() && this.delayed());

  constructor() {
    const router = inject(Router);

    router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.navigating.set(true);
        this.schedule();
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.navigating.set(false);
        this.settle();
      }
    });
  }

  start(): void {
    this.inFlight.update((count) => count + 1);
    this.schedule();
  }

  done(): void {
    this.inFlight.update((count) => Math.max(0, count - 1));
    this.settle();
  }

  private schedule(): void {
    if (this.timer !== null || this.delayed()) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.delayed.set(true);
    }, 150);
  }

  private settle(): void {
    if (this.busy()) {
      return;
    }

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.delayed.set(false);
  }
}
