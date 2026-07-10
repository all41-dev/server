import { Api, Ui, IApiOptions, IUiOptions, IJobOptions, IAmqpOptions, IStaticRouteOptions, IWsOptions } from '@all41-dev/server.types';
import { Db, IDbOptions } from '@all41-dev/db-tools';
import { LoggerOptions } from 'winston';
import { Repository, Workflow, WorkflowContext } from '@all41-dev/server.types';
import { IAuthOptions } from '@all41-dev/iam';

export interface IServerOptions {
  consoleLogLevel?: string;
  auth?: IAuthOptions;
  apis?: IApiOptions<Api<any>> | IApiOptions<Api<any>>[];
  uis?: IUiOptions<Ui<any>> | IUiOptions<Ui<any>>[];
  dbs?: IDbOptions<Db<any>> | IDbOptions<Db<any>>[];
  jobs?: IJobOptions | IJobOptions[];
  amqp?: { [key: string]: IAmqpOptions };
  statics?: IStaticRouteOptions | IStaticRouteOptions[];
  repositories?: { [key: string]: Repository<any> };
  workflows?: { [key: string]: new (context: WorkflowContext) => Workflow<any> };
  websockets?: { [key: string]: IWsOptions };
  loggerOptions?: LoggerOptions;
  skipJobScheduleAtStartup?: boolean;
  mute?: boolean;
  httpPort?: number;
  masterApiKey?: string;
}
