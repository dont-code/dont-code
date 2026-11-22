import {DOCUMENT, inject, Injectable, signal} from '@angular/core';
import {httpResource} from '@angular/common/http';
import {RepositoryConfig} from '../../model/repository-config';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {

  protected repoName=signal<string|null|undefined>(undefined)
  protected document = inject(DOCUMENT);

  repository = httpResource<RepositoryConfig>(() => {
    if (this.repoName()) {
      return 'assets/config/'+this.repoName()+'.json';
    } else return 'assets/config/default.json'
  });

  updateRepoName(repoName:string|undefined|null):void {
    const oldName = this.repoName();
    if (oldName != repoName) {
      this.repoName.set(repoName);
    }
  }

  resolveUrl(url: string | null | undefined): string | null {
    if (url == null || url === '') return null;
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) return url;

    const base = this.document.baseURI || this.document.defaultView?.location?.href;
    if (!base) return url;

    try {
      return new URL(url, base).toString();
    } catch {
      return url;
    }
  }

  resolveWebSocketUrl(url: string | null | undefined): string | null {
    const resolved = this.resolveUrl(url);
    if (resolved == null) return null;

    if (resolved.startsWith('https://')) return 'wss://' + resolved.substring('https://'.length);
    if (resolved.startsWith('http://')) return 'ws://' + resolved.substring('http://'.length);
    return resolved;
  }

}
