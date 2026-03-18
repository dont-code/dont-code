import {ChangeDetectionStrategy, Component, computed, inject, input, OnInit} from '@angular/core';
import {AppInfo} from '../model/app-info';
import {AppPanel} from '../app-panel/app-panel';
import {httpResource, HttpResourceRef} from '@angular/common/http';
import {RepositoryConfig} from '../model/repository-config';
import {ConfigService} from '../shared/config-service/config-service';

@Component({
  selector: 'app-list-of-apps',
  imports: [
    AppPanel
  ],
  templateUrl: './list-of-apps.html',
  styleUrl: './list-of-apps.css',
  changeDetection:ChangeDetectionStrategy.OnPush
})
export class ListOfApps implements OnInit {

  repoName = input<string>();

  config = inject(ConfigService);

  repository (): HttpResourceRef<RepositoryConfig | undefined> {
    return this.config.repository;
  }

  appInDb = httpResource<any[]>(() => {
      if (this.repository().hasValue()) {
        return this.repository().value()?.projectApiUrl;
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

  ngOnInit(): void {
    this.config.updateRepoName(this.repoName());
  }

}
