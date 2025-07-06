import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppPanel } from './app-panel';

describe('AppPanel', () => {
  let component: AppPanel;
  let fixture: ComponentFixture<AppPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
