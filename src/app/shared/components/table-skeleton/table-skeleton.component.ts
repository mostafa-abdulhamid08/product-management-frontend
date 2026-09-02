import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-table-skeleton',
  templateUrl: './table-skeleton.component.html',
})
export class TableSkeletonComponent {
  readonly loadingLabel = input<string>('Loading…');
  readonly rows = input<number>(8);
  readonly columns = input<number>(5);

  readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
  readonly columnList = computed(() => Array.from({ length: this.columns() }, (_, i) => i));
}
