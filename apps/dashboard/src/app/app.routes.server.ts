import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path:'',
    renderMode: RenderMode.Prerender
  }
  ,{
    path:'repo/:repoName',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams () {
      return [
        { repoName:'collinfr'},
        { repoName:'default'}
      ];
    }
  }
  ,{
    path: 'generate/:repoName',
    renderMode: RenderMode.Client
  }
  ,{
    path: '**',
    renderMode: RenderMode.Server
  }
];
