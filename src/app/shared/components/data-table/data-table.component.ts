import { Component, computed, contentChild, input, output, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { PaginationMeta } from '../../../core/models/api-response.model';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { TableSkeletonComponent } from '../table-skeleton/table-skeleton.component';

export interface DataTableColumn {
  label: string;
  /** Tailwind alignment for the header cell. Body cells stay with the row template. */
  align?: 'start' | 'center' | 'end';
  /** Optional width utility, e.g. 'w-16'. */
  width?: string;
}

/**
 * The part every list screen repeats: the card, the header row, the four states,
 * and the pagination with its result count. Everything specific to a feature —
 * filters, cell markup, row actions — stays in the feature. Rows come in through
 * a template so this never needs to know what a product or a role looks like.
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, PaginationComponent, TableSkeletonComponent, EmptyStateComponent],
  templateUrl: './data-table.component.html',
})
export class DataTableComponent<T extends { id: number }> {
  readonly rows = input.required<T[]>();
  readonly columns = input.required<DataTableColumn[]>();
  readonly meta = input<PaginationMeta | null>(null);

  readonly loading = input(false);
  readonly failed = input(false);
  /** Whether a filter is active, which decides *which* empty state to show. */
  readonly filtered = input(false);
  readonly skeletonRows = input(8);

  readonly emptyHeading = input('Nothing here yet');
  readonly emptyMessage = input('');
  readonly filteredHeading = input('No matches');
  readonly filteredMessage = input('Try a different search, or clear the filters.');
  readonly errorHeading = input('Could not load this list');
  readonly errorMessage = input('The request did not come back. It may be a connection problem.');

  readonly retry = output<void>();
  readonly clearFilters = output<void>();
  readonly pageChange = output<number>();

  readonly rowTemplate = contentChild.required<TemplateRef<{ $implicit: T }>>('row');

  readonly isEmpty = computed(() => !this.loading() && !this.failed() && this.rows().length === 0);

  headerClass(column: DataTableColumn): string {
    const align = column.align ?? 'start';

    return `px-4 py-3 font-medium text-${align} ${column.width ?? ''}`;
  }
}
