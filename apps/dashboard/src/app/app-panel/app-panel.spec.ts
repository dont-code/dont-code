import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppPanel } from './app-panel';

describe('AppPanel', () => {
  let component: AppPanel;
  let fixture: ComponentFixture<AppPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppPanel],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppPanel);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('appInfo', {name: 'Demo app', description: 'A demo application'});
    fixture.componentRef.setInput('repository', {
      name: 'default',
      projectApiUrl: 'https://api.example.com/projects/',
      generateApiUrl: 'https://api.example.com/generate/',
      applicationHostUrl: 'https://host.example.com/'
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the application name', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('mat-card-title')?.textContent).toContain('Demo app');
  });

  it('should build the host url from the repository config', () => {
    expect(component.calculateHostUrl({name: 'My project'})).toBe('https://host.example.com/project=My%20project');
  });
});
