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
    const config = (window as any).dashboardConfig;

    const action=config.action;
    console.log(action);
    if (action!=null) {
      this.runAction(action);
    }
  }

  runAction (actionName:string) {
    if (actionName == 'generate') {
      return this.router.navigate(['generate','default']);
    } else {
      return Promise.reject("No action named "+actionName);
    }
  }
}
