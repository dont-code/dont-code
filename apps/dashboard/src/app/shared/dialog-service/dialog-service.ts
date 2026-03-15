import {Injectable, signal} from '@angular/core';
import {QuestionOrAnswer} from './question-answer';
import {GenerateApp} from '../../generate-app/generate-app';
import {ApplicationModel} from '../../model/application';
import {GenerateAppModel} from '../../model/generate-app';

@Injectable({
  providedIn: 'root',
})
export class DialogService {
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

  addAnswer (response:string):void {
    const answer = new QuestionOrAnswer();
    answer.isQuestion = false;
    try {
      const responseModel = JSON.parse(response) as GenerateAppModel;
      answer.model=responseModel.model;
      answer.text = responseModel.response;
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
