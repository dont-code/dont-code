import { XtTypeReference } from 'xt-type';

export type ApplicationModel = {
  name:string,
  description?: string,
  content: {
    creation: {
      type?: string,
      entities?: Array<EntityModel>,
      sharing?: {
        with: 'Dont-code users'|'No-one'|'Volatile'
      }
    }
  }
}

export type EntityModel = {
  name: string,
  fields?: Array<FieldModel>,
  compatibleWith?: string[]
}

export type FieldModel = {
  name: string,
  type: string,
  reference?: XtTypeReference
}
