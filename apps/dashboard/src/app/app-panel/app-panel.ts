import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {MatCard, MatCardHeader, MatCardImage, MatCardSubtitle, MatCardTitle} from '@angular/material/card';
import {AppInfo} from '../model/app-info';
import {RepositoryConfig} from '../model/repository-config';
import {Router} from '@angular/router';
import {ConfigService} from '../shared/config-service/config-service';

@Component({
  selector: 'app-app-panel',
  imports: [
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardSubtitle,
    MatCardImage
  ],
  templateUrl: './app-panel.html',
  styleUrl: './app-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppPanel {

  appInfo = input.required<AppInfo>();
  repository= input.required<RepositoryConfig>();

  router = inject(Router);
  config = inject(ConfigService);

  imageUrl(app:AppInfo) {
    if (app.imgUrl != null)
      return this.config.resolveUrl(app.imgUrl) ?? app.imgUrl;
    const url=this.router.createUrlTree(['assets','app-default-img.jpg'], {relativeTo:null});
     return url.toString();
  }

  calculateHostUrl(app: AppInfo):string|null {
    const applicationHostUrl = this.config.resolveUrl(this.repository().applicationHostUrl);
    if (applicationHostUrl == null) return null;
    return applicationHostUrl+'project='+encodeURIComponent(app.name);
  }
}
