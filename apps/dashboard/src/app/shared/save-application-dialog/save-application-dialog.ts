import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';

export type SaveApplicationDialogData = {
  applicationName: string;
};

@Component({
  selector: 'app-save-application-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './save-application-dialog.html',
  styleUrl: './save-application-dialog.css',
})
export class SaveApplicationDialog {
  private dialogRef = inject(MatDialogRef<SaveApplicationDialog>);
  data = inject<SaveApplicationDialogData>(MAT_DIALOG_DATA);

  applicationName = this.data.applicationName ?? '';

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const name = this.applicationName.trim();
    if (!name) {
      return;
    }

    this.dialogRef.close(name);
  }
}
