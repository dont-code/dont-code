import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {MatCard, MatCardHeader, MatCardImage, MatCardSubtitle, MatCardTitle} from '@angular/material/card';
import {AppInfo} from '../model/app-info';
import {RepositoryConfig} from '../model/repository-config';

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

  imageUrl(app:AppInfo) {
    return app.imgUrl?? "assets/app-default-img.jpg";
  }

  calculateHostUrl(app: AppInfo):string {
    return this.repository().applicationHostUrl+'project='+encodeURIComponent(app.name);
  }
}
