import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {MatButton} from "@angular/material/button";
import {SaveApplicationDialogReturn} from '../save-application-dialog/save-application-dialog';

@Component({
  selector: 'app-saved-application-link',
    imports: [
        MatButton
    ],
  templateUrl: './saved-application-link.html',
  styleUrl: './saved-application-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedApplicationLink {
  saveResult = input<SaveApplicationDialogReturn> ();

  protected isProjectSavedStatus = computed(()=> {
    return this.saveResult() != null;
  });

  protected isProjectSaved = computed(()=> {
      return this.saveResult()?.appUrl!=null;
    });

  protected isProjectError = computed(()=>{
    return this.saveResult()?.outcome=='error';
  });

}
