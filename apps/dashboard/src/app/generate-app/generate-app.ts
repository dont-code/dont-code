import {Component, computed, effect, ElementRef, inject, input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {HttpClient, HttpResourceRef} from '@angular/common/http';
import {RepositoryConfig} from '../model/repository-config';
import {ConfigService} from '../shared/config-service/config-service';
import {MatFormField, MatInput, MatLabel, MatSuffix} from '@angular/material/input';
import {UserDialogService} from '../shared/dialog-service/user-dialog.service';
import {FormsModule} from '@angular/forms';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {GenerateAppService} from '../shared/generate-app-service/generate-app-service';
import {ApplicationModel} from '../model/application';
import {PreviewApp} from '../preview-app/preview-app';
import {lastValueFrom} from 'rxjs';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {SaveApplicationDialog} from './save-application-dialog';

@Component({
  selector: 'app-generate-app',
  imports: [
    MatFormField,
    MatLabel,
    MatInput,
    FormsModule,
    MatIconButton,
    MatIcon,
    MatSuffix,
    MatDialogModule,
    PreviewApp
  ],
  templateUrl: './generate-app.html',
  styleUrl: './generate-app.css',
})
export class GenerateApp implements OnInit, OnDestroy {

  @ViewChild('chatThread')
  private chatThread?: ElementRef<HTMLDivElement>;

  repoName = input<string>();

  config = inject(ConfigService);
  dialog = inject(UserDialogService);
  generator = inject(GenerateAppService);
  httpClient = inject(HttpClient);
  matDialog = inject(MatDialog);

  protected currentQuestion: string = "I'd like to have an application for ...";
  protected isWaitingForAnswer = false;
  protected saveStatusMessage = '';
  protected saveStatusType: 'success' | 'error' | '' = '';

  protected toDisconnect: Array<number> = [];

  protected currentProject: DontCodeProject | null = null;

  protected latestGeneratedApp = computed<ApplicationModel | undefined>(() => {
    const session = this.dialog.dialogSession();
    for (let index = session.length - 1; index >= 0; index--) {
      const item = session[index];
      if (!item.isQuestion && item.model) {
        return item.model;
      }
    }
    return;
  });

  constructor() {
    effect(() => {
      this.dialog.dialogSession();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  repository(): HttpResourceRef<RepositoryConfig | undefined> {
    return this.config.repository;
  }

  ngOnInit(): void {
    this.config.updateRepoName(this.repoName());
    this.toDisconnect.push(this.generator.messageReceiver((response) => {
        this.isWaitingForAnswer = false;
        this.dialog.addAnswer(response);
      }, (err: Error) => {
        this.isWaitingForAnswer = false;
        this.dialog.addError(err);
      })
    );
  }

  addQuestion() {
    const question = this.currentQuestion.trim();
    if (!question || this.isWaitingForAnswer) {
      return;
    }

    this.dialog.addQuestion(question);
    this.isWaitingForAnswer = true;

    this.generator.sendMessage(question).catch((error) => {
      this.isWaitingForAnswer = false;
      this.dialog.addError(error);
    });

    this.currentQuestion = '';
    queueMicrotask(() => this.scrollToBottom());
  }

  async saveApplication(): Promise<void> {
    this.saveStatusMessage = '';
    this.saveStatusType = '';

    const dialogRef = this.matDialog.open(SaveApplicationDialog, {
      width: '32rem',
      disableClose: false,
      data: {
        applicationName: this.latestGeneratedApp()?.name ?? ''
      }
    });

    const applicationName = await lastValueFrom(dialogRef.afterClosed());
    if (!applicationName) {
      return;
    }

    try {
      await this.saveProjectDefinition(applicationName);
      this.saveStatusType = 'success';
      this.saveStatusMessage = 'Saving was ok.';
    } catch (error) {
      this.saveStatusType = 'error';
      this.saveStatusMessage = `Error while saving: ${error}`;
    }
  }

  private scrollToBottom(): void {
    const element = this.chatThread?.nativeElement;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: 'smooth'
    });
  }

  ngOnDestroy(): void {
    for (const toRemove of this.toDisconnect) {
      this.generator.removeReceiver(toRemove);
    }
  }

  async saveProjectDefinition(prjName: string): Promise<void> {
    const prjApiUrl = this.config.repository.value()?.projectApiUrl;
    if (prjApiUrl == null) return Promise.reject('No project API url defined.');
    const generatedApp = this.latestGeneratedApp();

    if (generatedApp == null) {
      return Promise.reject('No project definition to save');
    }

    if (prjName) {
      if (this.currentProject == null) {
        this.currentProject = new DontCodeProject();
      }
      this.currentProject.lastUpdated = new Date();
      this.currentProject.name = prjName;
      this.currentProject.content = generatedApp;
      try {
        if (this.currentProject._id) {
          await lastValueFrom(this.httpClient.put(prjApiUrl + '/' + prjName, this.currentProject, {responseType: 'json'}));
        } else {
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

}

class DontCodeProject {
  _id?: string;
  name: string = '';
  template: boolean = false;
  description: string = '';
  lastUpdated: Date | undefined;
  content?: ApplicationModel;
}
