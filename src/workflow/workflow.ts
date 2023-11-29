import { IPkName, IRepositoryWritable } from "../repository/repository";

export interface Context {
  source: string;
  data: any;
}
// export type Context = ContextStd & any;

export interface Workflow<T extends IPkName<T>> {
  readonly modelType: new (plainObj?: Partial<T>) => T;
  actors: { [key: string]: Actor<T> }
  actions: { [key: string]: Action<T> };
}

export class Workflow<T extends IPkName<T>> {
  public async run(source: string, data: Partial<T>): Promise<T[]> {
    const electedKeys = Object.keys(this.actions)
      .filter((key) => this.actions[key].condition({ source, data }));
    const result = await Promise.all(electedKeys.map(async (key) => this.executeAction(this.actions[key], source, data)));
    return result;
  }
  private async executeAction(action: Action<T>, source: string, data: any): Promise<T> {
    {
      const res = action.doAwait ?
        await action.execute(data) :
        action.execute(data);
      const electedSuccessors = action.successors.filter((successor) => successor.condition({ source, data }));
      const successorsResult = Promise.all(electedSuccessors.map(async (successor) => this.executeAction(successor, source, data)));
      action.doAwait ? await successorsResult : successorsResult;
      return res;
    }
  }
}

export interface Actor<T extends IPkName<T>> {
  repository: IRepositoryWritable<T>;
}

export interface Action<T> {
  successors: Action<T>[];
  condition: (context: Context) => boolean;
  execute: (data: Partial<T>) => Promise<T>;
  doAwait?: boolean;
}
