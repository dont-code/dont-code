import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {ApplicationModel} from '../../model/application';
import {ProjectService} from '../project-service/project-service';
import {SavedApplicationLink} from '../saved-application-link/saved-application-link';

export type SaveApplicationDialogData = {
  applicationName: string;
  applicationDefinition: ApplicationModel
};

export type SaveApplicationDialogReturn = {
  outcome: 'success'|'error';
  appUrl?:string;
  error?:any;
}

@Component({
  selector: 'app-save-application-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    SavedApplicationLink
  ],
  templateUrl: './save-application-dialog.html',
  styleUrl: './save-application-dialog.css',
})
export class SaveApplicationDialog {
  private dialogRef = inject(MatDialogRef<SaveApplicationDialog>);
  data = inject<SaveApplicationDialogData>(MAT_DIALOG_DATA);
  projectService = inject(ProjectService);

  applicationName = this.data.applicationName ?? '';
  lastSaveResult = signal< SaveApplicationDialogReturn|undefined> ( undefined);

  isProjectSavedStatus = computed (()=> {
    return this.lastSaveResult()!=null;
  });

  isProjectSaved = computed (()=> {
    return this.lastSaveResult()?.appUrl;
  });

  isProjectError = computed (()=> {
    return this.lastSaveResult()?.outcome=='error';
  });

  close(): void {
    this.dialogRef.close(this.lastSaveResult());
  }


  async save(): Promise<void> {
    const name = this.applicationName.trim();
    if (!name) {
      return;
    }

    return this.projectService.saveProjectDefinition(name, this.data.applicationDefinition).then( () =>{
      const appURl=this.projectService.lastProjectUrl();
      this.lastSaveResult.set({ outcome:'success', appUrl:appURl??undefined});

    }).catch((reason) => {
      this.lastSaveResult.set({ outcome:'error', error:reason});
    });

  }
}
