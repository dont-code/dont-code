import {Component, inject, input, OnInit} from '@angular/core';
import {RepositoryConfig} from '../model/repository-config';
import {httpResource, HttpResourceRef} from '@angular/common/http';
import {ConfigService} from '../shared/config-service/config-service';
import {MatFormField, MatInput, MatLabel, MatPrefix, MatSuffix} from '@angular/material/input';
import {DialogService} from '../shared/dialog-service/dialog-service';
import {FormsModule} from '@angular/forms';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {GenerateAppService} from '../shared/generate-app-service/generate-app-service';

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
    MatPrefix
  ],
  templateUrl: './generate-app.html',
  styleUrl: './generate-app.css',
})
export class GenerateApp implements OnInit {

  repoName = input<string>();

  config = inject(ConfigService);
  dialog = inject(DialogService);
  generator = inject(GenerateAppService);

  protected currentQuestion: string="I'd like to have an application for ...";

  repository (): HttpResourceRef<RepositoryConfig | undefined> {
    return this.config.repository;
  }

  ngOnInit(): void {
    this.config.updateRepoName(this.repoName());
    this.generator.messageReceiver ((response)=> {
      this.dialog.addAnswer(response);
    });
  }

  addQuestion() {
    const question = this.currentQuestion.trim();
    if (!question) {
      return;
    }

    this.dialog.addQuestion(question);
    this.generator.sendMessage(question).catch((error) => {
      this.dialog.addError(error);
    });
    this.currentQuestion = '';
  }

}
