import { Api } from './api';
import { Db, IDbOptions } from '@all41-dev/db-tools';
import { Ui } from './ui';
import { LoggerOptions } from 'winston';
import AMQP from 'amqplib';

export interface IServerOptions {
  consoleLogLevel?: string;
  auth?: IAuthOptions;
  apis?: IApiOptions<Api<any>> | IApiOptions<Api<any>>[];
  uis?: IUiOptions<Ui<any>> | IUiOptions<Ui<any>>[];
  dbs?: IDbOptions<Db<any>> | IDbOptions<Db<any>>[];
  jobs?: IJobOptions | IJobOptions[];
  amqp?: {[key: string]: IAmqpOptions};
  statics?: IStaticRouteOptions | IStaticRouteOptions[];
  loggerOptions?: LoggerOptions;
  skipJobScheduleAtStartup?: boolean;
}

export interface IRouteOptions {
  baseRoute: string;
}

export interface IApiOptions<T extends Api<any>> extends IRouteOptions {
  type: { new(options: IApiOptions<T>): T};
  config?: any;
  requireAuth?: boolean;
}

export interface IJobOptions {
  schedule: string;
  function: () => any;
  name: string;
  config?: any;
  executeOnStart: boolean;
  context?: any;
}

export interface IUiOptions<T extends Ui<any>> extends IRouteOptions {
  type: {  inst: T; new(options: IUiOptions<T>): T};
  config?: any;
  requireAuth?: boolean;
  requireScope?: string[];
}

export interface IAmqpOptions {
  AMQP_URL: string | "amqp://localhost";
  connection: AMQP.Connection | undefined;
  channels: { [key: string]: AMQP.Channel };
}

export interface IStaticRouteOptions extends IRouteOptions {
  ressourcePath: string;
  config?: any;
  requireAuth?: boolean;
}

export interface IAuthOptions {
  required: boolean;
  issuerBaseURL: string;
  baseURL?: string;
  clientID: string;
  clientSecret: string;
  authorizationParams: {
    response_type: string;
    scope?: string;
  };
  idpLogout: boolean;
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
