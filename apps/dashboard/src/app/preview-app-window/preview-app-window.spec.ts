import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreviewAppWindow } from './preview-app-window';
import { ApplicationModel } from '../model/application';

describe('PreviewAppWindow', () => {
  let component: PreviewAppWindow;
  let fixture: ComponentFixture<PreviewAppWindow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewAppWindow]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreviewAppWindow);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('app', {name: 'Test', content: {creation: {}}} as ApplicationModel);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
