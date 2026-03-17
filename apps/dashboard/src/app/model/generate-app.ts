import {ApplicationModel} from './application';

/**
 * The data model received from the generate API code. It enables dialog with the user and contains the application description in json
 */
export type GenerateAppModel = {
  response:string,
  error?:string,
  model?: ApplicationModel
}
