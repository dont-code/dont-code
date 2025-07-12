import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import {provideHttpClient, withFetch} from '@angular/common/http';
import { withComponentInputBinding } from '@angular/router';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideHttpClient(withFetch())

  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
