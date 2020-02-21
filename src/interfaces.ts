import Sequelize from 'sequelize-typescript';
import { Api } from './api';
import { Db } from './db';
import { UI } from './ui';
import { LoggerOptions } from 'winston';

export interface IServerOptions {
  auth?: IAuthOptions;
  apis?: IServerApiOptions | IServerApiOptions[];
  uis?: IServerUiOptions | IServerUiOptions[];
  dbs?: IServerDbOptions | IServerDbOptions[];
  jobs?: IServerJobOptions | IServerJobOptions[];
  loggerOptions?: LoggerOptions;
}

export interface IServerApiOptions<T = object> {
  baseRoute: string;
  instance: Api;
  config?: T;
  requireAuth?: boolean;
}

export interface IServerDbOptions<T = object> {
  instance: Db | Db[];
  config?: T;
}

export interface IServerJobOptions<T = object> {
  schedule: string;
  function: () => any;
  name: string;
  config?: T;
  executeOnStart: boolean;
  context?: any;
}

export interface IServerDbInstOptions {
  hostname?: string;
  dbName: string;
  username: string;
  password: string;
  port?: number;
  engine?: string;
  sqliteStoragePath?: string;
  instanceName?: string;
}

export interface IServerUiOptions<T = object> {
  baseRoute: string;
  instance: UI;
  config?: T;
  requireAuth?: boolean;
}

export interface IApiOptions<T = object> {
  baseRoute: string;
  config?: T;
  requireAuth?: boolean;
}

export interface IUiOptions<T = object> {
  config?: T;
  requireAuth?: boolean;
}

export interface IDatabaseOptions<T = object> {
  sequelize: Sequelize.Sequelize;
  config?: T;
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
