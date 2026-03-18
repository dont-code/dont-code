import {Component, computed, effect, ElementRef, inject, input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {HttpResourceRef} from '@angular/common/http';
import {RepositoryConfig} from '../model/repository-config';
import {ConfigService} from '../shared/config-service/config-service';
import {MatFormField, MatInput, MatLabel, MatSuffix} from '@angular/material/input';
import {DialogService} from '../shared/dialog-service/dialog-service';
import {FormsModule} from '@angular/forms';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {GenerateAppService} from '../shared/generate-app-service/generate-app-service';
import {ApplicationModel} from '../model/application';
import {PreviewApp} from '../preview-app/preview-app';

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
  dialog = inject(DialogService);
  generator = inject(GenerateAppService);

  protected currentQuestion: string = "I'd like to have an application for ...";
  protected isWaitingForAnswer = false;

  protected toDisconnect: Array<number>=[];

  protected latestGeneratedApp = computed<ApplicationModel | undefined>(() => {
    const session = this.dialog.dialogSession();
    for (let index = session.length - 1; index >= 0; index--) {
      const item = session[index];
      if (!item.isQuestion && item.model) {
        return item.model;
      }
    }
    return ;
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
      }, (err:Error) => {
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

}
