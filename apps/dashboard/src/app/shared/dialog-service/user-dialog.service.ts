import {Injectable, signal} from '@angular/core';
import {QuestionOrAnswer} from './question-answer';
import {GenerateAppModel} from '../../model/generate-app';

@Injectable({
  providedIn: 'root',
})
export class UserDialogService {
  dialogSession = signal<Array<QuestionOrAnswer>>([]);

  addQuestion (text:string):void {
    const question = new QuestionOrAnswer();
    question.text = text;
    question.isQuestion = true;
    this.dialogSession.update( (old) => {
      question.id=old.length+1;
      return [...old, question]
    });
  }

  addAnswer (response:any):void {
    const answer = new QuestionOrAnswer();
    answer.isQuestion = false;
    try {
      const responseModel = (typeof response == "string")?JSON.parse(response) as GenerateAppModel:response as GenerateAppModel;
      answer.model=responseModel.model??null;
      if ((responseModel.error!=null)&&(responseModel.error.length>0)){
        answer.errorMessage=responseModel.error;
      } else {
        answer.text = responseModel.response;
      }
    } catch (error) {
      console.error(error);
      answer.errorMessage=(error as SyntaxError).toString();
    }

    this.dialogSession.update( (old) => {
      answer.id=old.length+1;
      return [...old, answer];
    });
  }

  addError(error: any) {
    const answer = new QuestionOrAnswer();
    answer.isQuestion = false;
    answer.errorMessage=error.toString();
    this.dialogSession.update( (old) => {
      answer.id=old.length+1;
      return [...old, answer];
    });

  }
}
