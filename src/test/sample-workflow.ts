import { SampleAMQPRepository, SampleSequelizeRepository, SampleTable } from "../test/sample-repository";
import { Action, Actor, WorkflowContext, Workflow } from "../workflow/workflow";

export class SampleWorkflow<C extends WorkflowContext = WorkflowContext> extends Workflow<SampleTable, C> implements Workflow<SampleTable, C>{
  modelType: new (plainObj?: Partial<SampleTable> | undefined) => SampleTable;
  actors: { [key: string]: Actor<SampleTable>; };
  actions: { [key: string]: Action<SampleTable, C> };
  context: C;

  constructor(ctx: C) {
    super();
    this.modelType = SampleTable;
    this.actors = {
      sequelize: {
        repository: new SampleSequelizeRepository(),
      },
      amqp: {
        repository: new SampleAMQPRepository as any, // TODO fix this any use
      }
    }
    this.actions = {
      post: {
        condition: (context) => context.source === 'api',
        execute: async (actionContext) => this.actors.sequelize.repository.post(actionContext.record as SampleTable),
        doAwait: false,
        successors: [{
          condition: (context) => context.actionContext instanceof SampleTable,
          successors: [],
          execute: (actionContext) => this.actors.amqp.repository.post(actionContext.record as SampleTable),
        }],
      }
    }
    this.context = ctx;
  }
}