import { SampleAMQPRepository, SampleSequelizeRepository, SampleTable } from "../test/sample-repository";
import { Action, Actor, Workflow } from "../workflow/workflow";

export class SampleWorkflow extends Workflow<SampleTable> implements Workflow<SampleTable>{
  modelType: new (plainObj?: Partial<SampleTable> | undefined) => SampleTable;
  actors: { [key: string]: Actor<SampleTable>; };
  actions: { [key: string]: Action<SampleTable> };

  constructor() {
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
        execute: async (data) => this.actors.sequelize.repository.post(data as SampleTable),
        doAwait: false,
        successors: [{
          condition: (context) => context.data instanceof SampleTable,
          successors: [],
          execute: (data) => this.actors.amqp.repository.post(data as SampleTable),
        }],
      }
    }
  }
}