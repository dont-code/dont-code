import {ApplicationModel} from '../../model/application';

export class QuestionOrAnswer {
  id:number=0;
  isQuestion: boolean=true;
  text: string="";
  model: ApplicationModel|null=null;
  errorMessage: string|null = null;
}
