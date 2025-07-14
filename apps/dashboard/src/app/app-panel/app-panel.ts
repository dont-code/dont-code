import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {MatCard, MatCardHeader, MatCardImage, MatCardSubtitle, MatCardTitle} from '@angular/material/card';
import {AppInfo} from '../model/app-info';
import {RepositoryConfig} from '../model/repository-config';
import {Router} from '@angular/router';

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

  imageUrl(app:AppInfo) {
    if (app.imgUrl != null)
      return app.imgUrl;
    const url=this.router.createUrlTree(['assets','app-default-img.jpg'], {relativeTo:null});
     return url.toString();
  }

  calculateHostUrl(app: AppInfo):string {
    return this.repository().applicationHostUrl+'project='+encodeURIComponent(app.name);
  }
}
