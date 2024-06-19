import { IPkName, IRepositoryWritable } from "../repository/repository"

export interface WorkflowContext {
  source: string;
  actionContext: {[key : string]: any, record: any};
}
// export type Context = ContextStd & any;

export interface Workflow<T extends IPkName<T>, C extends WorkflowContext = WorkflowContext> {
  readonly modelType: new (plainObj?: Partial<T>) => T;
  actors: { [key: string]: Actor<T> }
  actions: { [key: string]: Action<T, C> };
  context: C;
}

export class Workflow<T extends IPkName<T>, C extends WorkflowContext = WorkflowContext> {
  public async run(): Promise<(T | void)[]> {
    const electedKeys = Object.keys(this.actions)
      .filter((key) => this.actions[key].condition(this.context));
    const result = await Promise.all(electedKeys.map(async (key) => this.executeAction(this.actions[key], this.context)));
    return result;
  }
  private async executeAction(action: Action<T, C>, ctx : C): Promise<T |void> {
    {
      const res = action.doAwait ?
        await action.execute(ctx.actionContext) :
        action.execute(ctx.actionContext);
      const electedSuccessors = action.successors.filter((successor) => successor.condition(ctx));
      const successorsResult = Promise.all(electedSuccessors.map(async (successor) => this.executeAction(successor, ctx)));
      action.doAwait ? await successorsResult : successorsResult;
      return res;
    }
  }
}

export interface Actor<T extends IPkName<T>> {
  repository: IRepositoryWritable<T>;
}

export interface Action<T, C> {
  successors: Action<T, C>[];
  condition: (context: C) => boolean;
  execute: (actionContext: {[key : string]: any, record: Partial<T>}) => Promise<T | void>; // void in case of delete
  doAwait?: boolean;
}
