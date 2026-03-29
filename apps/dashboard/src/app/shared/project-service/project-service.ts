import {inject, Injectable} from '@angular/core';
import {ApplicationModel} from '../../model/application';
import {lastValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from '../config-service/config-service';

/**
 * Allows application to read / store project definitions
 */
@Injectable({
  providedIn: 'root',
})
export class ProjectService {

  httpClient = inject(HttpClient);
  protected currentProject: DontCodeProject | null = null;
  config = inject(ConfigService);

  async saveProjectDefinition(prjName: string, application:ApplicationModel|null): Promise<void> {
    const prjApiUrl = this.config.repository.value()?.projectApiUrl;
    if (prjApiUrl == null) return Promise.reject('No project API url defined.');
    const generatedApp = application;

    if (generatedApp == null) {
      return Promise.reject('No project definition to save');
    }

    if (prjName) {
        // Enforce saving the data
      if (generatedApp.content.creation.sharing?.with==null){
        generatedApp.content.creation.sharing={with:'Dont-code users'};
      }
      try {
        if (this.currentProject?._id != null) {
          this.currentProject = {...generatedApp, _id:this.currentProject._id, lastUpdated:new Date()};
          await lastValueFrom(this.httpClient.put(prjApiUrl + '/' + prjName, this.currentProject, {responseType: 'json'}));
        }else {
          this.currentProject = {...generatedApp, lastUpdated:new Date()};
          await lastValueFrom(this.httpClient.post(prjApiUrl, this.currentProject, {responseType: 'json'})).then(
            (response: any) => {
              this.currentProject!._id = response._id;
            });
        }

      } catch (error) {
        return Promise.reject(error);
      }
    }
  }

  lastProjectUrl():string|null {
    if (this.currentProject?._id!=null) {
      // Project has been saved properly
      return this.projectUrl(this.currentProject.name);
    } else return null;
  }

  projectUrl (prjName:string):string {
    return this.config.repository.value()?.applicationHostUrl+'project='+encodeURIComponent(prjName);
  }

}

type DontCodeProject = ApplicationModel&{
  _id?: string;
  lastUpdated: Date | undefined;
  imgUrl?:string;
}
