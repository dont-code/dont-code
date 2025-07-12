import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
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

  repoName = input<string>();

  config = httpResource<RepositoryConfig>(() => {
    if (this.repoName()) {
      return 'assets/config/'+this.repoName()+'.json';
    } else return 'assets/config/default.json'
  });

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
          description:val.description,
          imgUrl:val.imgUrl
        }
      }).sort ( (a,b) => {
        if ((a.imgUrl!=null) && (b.imgUrl==null)) {
          return -1;
        } else if ((a.imgUrl==null) && (b.imgUrl!=null)) {
          return 1;
        } else {
          return 0;
        }
      })
    }
    return [];
  })
}
