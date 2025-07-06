import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {MatCard, MatCardHeader, MatCardImage, MatCardSubtitle, MatCardTitle} from '@angular/material/card';
import {AppInfo} from '../model/app-info';

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

  imageUrl() {
    return "assets/app-default-img.jpg";
  }
}
