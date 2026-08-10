import { XtTypeReference } from 'xt-type';

export type ApplicationModel = {
  name:string,
  description?: string,
  content: {
    creation: {
      type?: string,
      entities?: Array<EntityModel>,
      workflows?: {
        [key:string]: WorkflowModel
      },
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

export type WorkflowModel = {
  entity: string,
  workflow: 'list-detail'|'carousel',
  data?: {
    sort?: WorkflowSortModel
  },
  display?: WorkflowDisplayModel,
  selection?: WorkflowSelectionModel
}

export type WorkflowSortModel = {
  [key: string]: WorkflowSortOption
}

export type WorkflowSortOption = 'ascending' | 'descending' | {
  direction: 'ascending' | 'descending',
  type: 'metadata'|'field',
}

export type WorkflowDisplayModel = {
  fields?: {
    [key:string]:'current-and-after'
  }
}

export type WorkflowSelectionModel = {
  field?: {
    key: string,
    type: 'closest-after' | 'closest-before'
  },
  metadata?: {
    [key:string]: 'last' | 'fist' | 'current-user'
  }
}
