import {Component, inject, input, OnInit} from '@angular/core';
import {RepositoryConfig} from '../model/repository-config';
import {httpResource, HttpResourceRef} from '@angular/common/http';
import {ConfigService} from '../shared/config-service/config-service';
import {MatFormField, MatInput, MatLabel} from '@angular/material/input';

@Component({
  selector: 'app-generate-app',
  imports: [
    MatFormField,
    MatLabel,
    MatInput
  ],
  templateUrl: './generate-app.html',
  styleUrl: './generate-app.css',
})
export class GenerateApp implements OnInit {

  repoName = input<string>();

  config = inject(ConfigService);



  repository (): HttpResourceRef<RepositoryConfig | undefined> {
    return this.config.repository;
  }

  ngOnInit(): void {
    this.config.updateRepoName(this.repoName());
  }


}
