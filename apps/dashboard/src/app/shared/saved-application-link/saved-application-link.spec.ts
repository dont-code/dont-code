import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavedApplicationLink } from './saved-application-link';

describe('SavedApplicationLink', () => {
  let component: SavedApplicationLink;
  let fixture: ComponentFixture<SavedApplicationLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedApplicationLink]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SavedApplicationLink);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
