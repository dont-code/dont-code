import {ChangeDetectionStrategy, Component, computed} from '@angular/core';
import {AppInfo} from '../model/app-info';
import {AppPanel} from '../app-panel/app-panel';
import {httpResource} from '@angular/common/http';
import {RepositoryConfig} from '../model/repository-config';

@Component({
  selector: 'app-list-of-apps',
  imports: [
    AppPanel
  ],
  templateUrl: './list-of-apps.html',
  styleUrl: './list-of-apps.css',
  changeDetection:ChangeDetectionStrategy.OnPush
})
export class ListOfApps {

  config = httpResource<RepositoryConfig>(() => 'assets/config/default.json');

  appInDb = httpResource<any[]>(() => {
      if (this.config.hasValue()) {
        return this.config.value()?.projectApiUrl;
      }
      return undefined
    }
  );

  apps = computed<AppInfo[]>(() => {
    if (this.appInDb.hasValue()) {
      const rawApps = this.appInDb.value();
      return rawApps?.map( (val) => {
        return {
          name:val.name,
          description:val.description
        }
      })
    }
    return [];
  })
}
