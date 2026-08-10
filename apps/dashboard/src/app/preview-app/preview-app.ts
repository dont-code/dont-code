import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {
  ApplicationModel,
  WorkflowDisplayModel,
  WorkflowModel,
  WorkflowSelectionModel,
  WorkflowSortModel
} from '../model/application';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {ConfigService} from '../shared/config-service/config-service';
import {HttpResourceRef} from '@angular/common/http';
import {RepositoryConfig} from '../model/repository-config';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-preview-app',
  imports: [
    MatIcon
  ],
  templateUrl: './preview-app.html',
  styleUrl: './preview-app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewApp {
  latestGeneratedApp = input<ApplicationModel>  ();

  config = inject(ConfigService);
  sanitizer = inject(DomSanitizer);

  protected previewMode: 'desktop' | 'mobile' = 'desktop';
  protected structureMode: 'structure' | 'preview' = 'structure';
  protected fullscreenMode = false;

  repository(): HttpResourceRef<RepositoryConfig | undefined> {
    return this.config.repository;
  }

  protected previewUrl = computed<SafeResourceUrl | null>(() => {
    const repo = this.repository().value();
    const app = this.latestGeneratedApp();
    const applicationHostUrl = repo?.applicationHostUrl;

    if (!applicationHostUrl || !app?.name) {
      return null;
    }

    const baseUrl = applicationHostUrl.endsWith('/')
      ? applicationHostUrl.slice(0, -1)
      : applicationHostUrl;
    const appSlug = encodeURIComponent(JSON.stringify(app));

    return this.sanitizer.bypassSecurityTrustResourceUrl(`${baseUrl}prjDef=${appSlug}`);
  });

  protected workflows = computed<Array<{name: string; workflow: WorkflowModel}>>(() => {
    const workflows = this.latestGeneratedApp()?.content.creation.workflows;
    if (!workflows) {
      return [];
    }
    return Object.entries(workflows).map(([name, workflow]) => ({name, workflow}));
  });

  protected workflowsCount = computed<number>(() => this.workflows().length);

  setPreviewMode(mode: 'desktop' | 'mobile'): void {
    this.previewMode = mode;
  }

  setStructureMode(mode: 'structure' | 'preview'): void {
    this.structureMode = mode;
  }

  toggleFullscreen(): void {
    this.fullscreenMode = !this.fullscreenMode;
  }

  isFullscreen(): boolean {
    return this.fullscreenMode;
  }

  get fullscreenPreviewClass(): string {
    return this.fullscreenMode ? 'fullscreen-preview' : '';
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

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
