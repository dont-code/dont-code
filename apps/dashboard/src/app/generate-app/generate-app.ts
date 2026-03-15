import {Component, computed, effect, ElementRef, inject, input, OnInit, ViewChild} from '@angular/core';
import {RepositoryConfig} from '../model/repository-config';
import {HttpResourceRef} from '@angular/common/http';
import {ConfigService} from '../shared/config-service/config-service';
import {MatFormField, MatInput, MatLabel, MatSuffix} from '@angular/material/input';
import {DialogService} from '../shared/dialog-service/dialog-service';
import {FormsModule} from '@angular/forms';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {GenerateAppService} from '../shared/generate-app-service/generate-app-service';
import {ApplicationModel} from '../model/application';

@Component({
  selector: 'app-generate-app',
  imports: [
    MatFormField,
    MatLabel,
    MatInput,
    FormsModule,
    MatIconButton,
    MatIcon,
    MatSuffix
  ],
  templateUrl: './generate-app.html',
  styleUrl: './generate-app.css',
})
export class GenerateApp implements OnInit {

  @ViewChild('chatThread')
  private chatThread?: ElementRef<HTMLDivElement>;

  repoName = input<string>();

  config = inject(ConfigService);
  dialog = inject(DialogService);
  generator = inject(GenerateAppService);

  protected currentQuestion: string = "I'd like to have an application for ...";
  protected isWaitingForAnswer = false;
  protected previewMode: 'desktop' | 'mobile' = 'desktop';

  protected latestGeneratedApp = computed<ApplicationModel | null>(() => {
    const session = this.dialog.dialogSession();
    for (let index = session.length - 1; index >= 0; index--) {
      const item = session[index];
      if (!item.isQuestion && item.model) {
        return item.model;
      }
    }
    return null;
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
    this.generator.messageReceiver((response) => {
      this.isWaitingForAnswer = false;
      this.dialog.addAnswer(response);
    });
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

  setPreviewMode(mode: 'desktop' | 'mobile'): void {
    this.previewMode = mode;
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

}
