import {Injectable, signal} from '@angular/core';
import {httpResource} from '@angular/common/http';
import {RepositoryConfig} from '../../model/repository-config';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {

  protected repoName=signal<string|null|undefined>(undefined)

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

}
