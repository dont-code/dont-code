import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {
  ApplicationModel,
  WorkflowDisplayModel,
  WorkflowModel,
  WorkflowSelectionModel,
  WorkflowSortModel
} from '../model/application';

@Component({
  selector: 'app-preview-app-window',
  imports: [
    MatIcon
  ],
  templateUrl: './preview-app-window.html',
  styleUrl: './preview-app-window.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewAppWindow {
  app = input.required<ApplicationModel>();
  fullscreen = input(false);

  protected workflows = computed<Array<{name: string; workflow: WorkflowModel}>>(() => {
    const workflows = this.app().content.creation.workflows;
    if (!workflows) {
      return [];
    }
    return Object.entries(workflows).map(([name, workflow]) => ({name, workflow}));
  });

  protected workflowsCount = computed<number>(() => this.workflows().length);

  protected sortLabel(sort?: WorkflowSortModel): string {
    if (!sort) {
      return 'None';
    }
    return Object.entries(sort)
      .map(([key, option]) => {
        const direction = typeof option === 'string' ? option : option.direction;
        return `${key}: ${direction}`;
      })
      .join(', ');
  }

  protected displayLabel(display?: WorkflowDisplayModel): string {
    if (!display?.fields) {
      return 'None';
    }
    return Object.entries(display.fields)
      .map(([key, rule]) => `${key}: ${rule}`)
      .join(', ');
  }

  protected selectionLabel(selection?: WorkflowSelectionModel): string {
    if (!selection) {
      return 'None';
    }
    const parts: string[] = [];
    if (selection.field) {
      parts.push(`${selection.field.type} ${selection.field.key}`);
    }
    if (selection.metadata) {
      Object.entries(selection.metadata)
        .forEach(([key, rule]) => parts.push(`${key}: ${rule}`));
    }
    return parts.length > 0 ? parts.join(', ') : 'None';
  }
}
