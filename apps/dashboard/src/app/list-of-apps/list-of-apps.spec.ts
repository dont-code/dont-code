import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListOfApps } from './list-of-apps';

describe('ListOfApps', () => {
  let component: ListOfApps;
  let fixture: ComponentFixture<ListOfApps>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListOfApps]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListOfApps);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
