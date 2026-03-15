import {Component, computed, effect, ElementRef, inject, input, OnInit, ViewChild} from '@angular/core';
import {HttpResourceRef} from '@angular/common/http';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {RepositoryConfig} from '../model/repository-config';
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
  sanitizer = inject(DomSanitizer);

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

  protected previewUrl = computed<SafeResourceUrl | null>(() => {
    const repo = this.repository().value();
    const app = this.latestGeneratedApp();
    const applicationHostUrl = repo?.applicationHostUrl;

    if (!applicationHostUrl || !app?.name) {
      return null;
    }

    const baseUrl = applicationHostUrl.endsWith('/')
      ? applicationHostUrl.slice(0, -1)
      : applicationHostUrl;
    const appSlug = this.slugify(app.name);

    return this.sanitizer.bypassSecurityTrustResourceUrl(`${baseUrl}/${appSlug}`);
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

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

}
