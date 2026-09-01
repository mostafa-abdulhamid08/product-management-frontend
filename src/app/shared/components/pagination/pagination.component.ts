import { Component, computed, input, output } from '@angular/core';

import { PaginationMeta } from '../../../core/models/api-response.model';

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {
  readonly meta = input.required<PaginationMeta>();
  readonly pageChange = output<number>();

  readonly from = computed(() => (this.meta().total === 0 ? 0 : this.rangeStart()));
  readonly to = computed(() =>
    Math.min(this.rangeStart() + this.meta().per_page - 1, this.meta().total),
  );

  /** A window of at most five page numbers, kept centred on the current page. */
  readonly pages = computed(() => {
    const { current_page: current, last_page: last } = this.meta();
    const start = Math.max(1, Math.min(current - 2, last - 4));
    const end = Math.min(last, Math.max(current + 2, 5));

    return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
  });

  private rangeStart(): number {
    return (this.meta().current_page - 1) * this.meta().per_page + 1;
  }

  go(page: number): void {
    const { current_page: current, last_page: last } = this.meta();

    if (page >= 1 && page <= last && page !== current) {
      this.pageChange.emit(page);
    }
  }
}
