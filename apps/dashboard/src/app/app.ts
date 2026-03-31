import {Component, inject} from '@angular/core';
import {Router, RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected router=inject(Router);
  protected title = 'dashboard';

  constructor() {
    if (typeof window !== 'undefined') {
      const config = (window as any).dashboardConfig;

      const action=config.action;
      //console.log(action);
      if (action!=null) {
        this.runAction(action, config.repo);
      }
    }
  }

  runAction (actionName:string, repoName?:string) {
    if (actionName == 'generate') {
      if (repoName==null) {repoName='default';}
      return this.router.navigate(['generate',repoName]);
    } else {
      return Promise.reject("No action named "+actionName);
    }
  }
}
