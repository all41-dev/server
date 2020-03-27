import Sequelize from 'sequelize-typescript';
import { Api } from './api';
import { Db } from './db';
import { UI } from './ui';
import { LoggerOptions } from 'winston';

export interface IServerOptions {
  consoleLogLevel?: 'trace'|'debug'|'info'|'warn'|'error'|'fatal';
  auth?: IAuthOptions;
  apis?: IApiOptions<Api<any>> | IApiOptions<Api<any>>[];
  uis?: IServerUiOptions | IServerUiOptions[];
  dbs?: IDbOptions<Db<any>> | IDbOptions<Db<any>>[];
  jobs?: IServerJobOptions | IServerJobOptions[];
  statics?: IServerStaticOptions | IServerStaticOptions[];
  loggerOptions?: LoggerOptions;
}

export interface IRouteOptions {
  baseRoute: string;
}

export interface IApiOptions<T extends Api<any>> extends IRouteOptions {
  type: { new(options: IApiOptions<T>): T}
  config?: any;
  requireAuth?: boolean;
}

export interface IDbOptions<T extends Db<any>> {
  type: { new(options: IDbOptions<T>): T; inst: T}
  proxy?: string;
  mysqlDecimalNumbers?: boolean;
  logging?: boolean;
  hostname?: string;
  dbName: string;
  username: string;
  password: string;
  port?: number;
  engine?: 'mysql' | 'postgres' | 'mssql' | 'sqlite' | 'mariadb' | undefined;
  sqliteStoragePath?: string;
  instanceName?: string;
}

export interface IServerJobOptions<T = object> {
  schedule: string;
  function: () => any;
  name: string;
  config?: T;
  executeOnStart: boolean;
  context?: any;
}

export interface IServerUiOptions<T = object> extends IRouteOptions {
  instance: UI;
  config?: T;
  requireAuth?: boolean;
}

export interface IServerStaticOptions<T = object> extends IRouteOptions {
  ressourcePath: string;
  config?: T;
  requireAuth?: boolean;
}

export interface IUiOptions<T = object> {
  config?: T;
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

export function applyMixins(derivedCtor: any, baseCtors: any[]): void {
  baseCtors.forEach((baseCtor): void => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name): void => {
      if (name !== 'constructor') {
        derivedCtor.prototype[name] = baseCtor.prototype[name];
      }
    });
  });
}
