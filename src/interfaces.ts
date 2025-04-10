import { Api } from './api';
import { Db, IDbOptions } from '@all41-dev/db-tools';
import { Ui } from './ui';
import { LoggerOptions } from 'winston';
import AMQP from 'amqplib';
import { Repository, Workflow, WorkflowContext } from '@all41-dev/server.types';
import { WebSocketServer } from 'ws';
import { IAuthOptions } from '@all41-dev/iam.api';

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

export interface IRouteOptions extends IMuteable {
  baseRoute: string;
}

export interface IApiOptions<T extends Api<any>> extends IRouteOptions {
  type: { new(options: IApiOptions<T>): T };
  config?: any;
  requireAuth?: boolean;
  amqp?: string;
}

export interface IJobOptions extends IMuteable {
  schedule: string;
  function: () => any;
  name: string;
  code: string;
  config?: any;
  executeOnStart: boolean;
  context?: any;
}

export interface IUiOptions<T extends Ui<any>> extends IRouteOptions {
  type: { inst: T; new(options: IUiOptions<T>): T };
  config?: any;
  requireAuth?: boolean;
  requireScope?: string[];
}

export interface IAmqpOptions extends IMuteable {
  params: AMQP.Options.Connect;
  connection?: AMQP.Connection;
  channels: { [key: string]: AMQP.Channel };
}

export interface IStaticRouteOptions extends IRouteOptions {
  ressourcePath: string;
  config?: any;
  requireAuth?: boolean;
  getRoutes?: { path: string, handler: (req: any, res: any) => void }[]
}

export interface IWsOptions {
  server: WebSocketServer;
  requireAuth?: boolean;
  path: string;
}

export interface IMuteable {
  mute?: boolean;
}
// export function applyMixins(derivedCtor: any, baseCtors: any[]): void {
//   baseCtors.forEach((baseCtor): void => {
//     Object.getOwnPropertyNames(baseCtor.prototype).forEach((name): void => {
//       if (name !== 'constructor') {
//         derivedCtor.prototype[name] = baseCtor.prototype[name];
//       }
//     });
//   });
// }
