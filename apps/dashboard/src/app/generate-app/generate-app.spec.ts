import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateApp } from './generate-app';

describe('GenerateApp', () => {
  let component: GenerateApp;
  let fixture: ComponentFixture<GenerateApp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateApp]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenerateApp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
