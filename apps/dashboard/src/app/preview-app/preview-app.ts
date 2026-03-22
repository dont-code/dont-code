import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {ApplicationModel} from '../model/application';
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
    const appSlug = this.slugify(app.name);

    return this.sanitizer.bypassSecurityTrustResourceUrl(`${baseUrl}/${appSlug}`);
  });

  setPreviewMode(mode: 'desktop' | 'mobile'): void {
    this.previewMode = mode;
  }

  setStructureMode(mode: 'structure' | 'preview'): void {
    this.structureMode = mode;
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

}
