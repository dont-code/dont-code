import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreviewApp } from './preview-app';

describe('PreviewApp', () => {
  let component: PreviewApp;
  let fixture: ComponentFixture<PreviewApp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewApp]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreviewApp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
