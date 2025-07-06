import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
import {MatGridList, MatGridTile} from '@angular/material/grid-list';
import {AppInfo} from '../model/app-info';
import {AppPanel} from '../app-panel/app-panel';

@Component({
  selector: 'app-list-of-apps',
  imports: [
    MatGridList,
    MatGridTile,
    AppPanel
  ],
  templateUrl: './list-of-apps.html',
  styleUrl: './list-of-apps.css',
  changeDetection:ChangeDetectionStrategy.OnPush
})
export class ListOfApps {
  apps = signal<AppInfo[]>([{
    name: 'App1'
  }, {
    name: 'App2'
  }]);

}
