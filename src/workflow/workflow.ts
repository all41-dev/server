import { IPkName, IRepositoryWritable } from "../repository/repository"

export interface Context {
  source: string;
  data: {record: any, additionnal?: any};
}
// export type Context = ContextStd & any;

export interface Workflow<T extends IPkName<T>, C extends Context = Context> {
  readonly modelType: new (plainObj?: Partial<T>) => T;
  actors: { [key: string]: Actor<T> }
  actions: { [key: string]: Action<T, C> };
}

export class Workflow<T extends IPkName<T>, C extends Context = Context> {
  public async run(ctx : C): Promise<(T | void)[]> {
    const electedKeys = Object.keys(this.actions)
      .filter((key) => this.actions[key].condition(ctx));
    const result = await Promise.all(electedKeys.map(async (key) => this.executeAction(this.actions[key], ctx)));
    return result;
  }
  private async executeAction(action: Action<T, C>, ctx : C): Promise<T |void> {
    {
      const res = action.doAwait ?
        await action.execute(ctx.data) :
        action.execute(ctx.data);
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
  execute: (data: {record: Partial<T>, additionnal?: any}) => Promise<T | void>; // void in case of delete
  doAwait?: boolean;
}
