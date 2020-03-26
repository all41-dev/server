import { DataType, Sequelize, SequelizeOptions } from 'sequelize-typescript';
import { IServerDbInstOptions } from './interfaces';
import { Server } from './server';

export abstract class Db {
  public static inst: Db;
  public sequelize!: Sequelize;
  private _options: IServerDbInstOptions;
  public constructor(options: IServerDbInstOptions) {
    this._options = options;

    this._configureSequelize({
      sqlEngine: options.engine,
      password: options.password,
      user: options.username,
      hostname: options.hostname,
      logging: options.logging,
      mysqlDecimalNumbers: options.mysqlDecimalNumbers,
      port: options.port,
      proxy: options.proxy,
      sqliteStoragePath: options.sqliteStoragePath,
    });
  }

  protected async _init(): Promise<void> {
    try {
      await this.sequelize.authenticate();
      Server.logger.info({
        message: `Connection has been established successfully => ${this._options.dbName}`,
        hash: 'db-connection'
      });
    } catch (err) {
      Server.logger.error({
        message: `Unable to connect to the database "${this._options.dbName}":`,
        hash: 'db-connection',
        error: err,
      });
    }
  }
  
  protected _configureSequelize(params: {
    sqlEngine: 'mysql' | 'postgres' | 'mssql' | 'sqlite' | 'mariadb' | undefined;
    sqliteStoragePath?: string;
    hostname?: string;
    logging?: boolean;
    user: string;
    password: string;
    port?: number;
    proxy?: string;
    mysqlDecimalNumbers?: boolean;
  }): void {
    if (params.sqlEngine === 'sqlite' && !params.sqliteStoragePath) {
      throw new Error('When db engine is sqlite, sqliteStoragePath must be set. Aborting..');
    }

    const port = params.port ? params.port :
      params.sqlEngine === 'mssql' ? 1433 :
      params.sqlEngine === 'postgres' ? 5432 :
      params.sqlEngine === 'sqlite' ? undefined :
      3306;// mariadb || mysql

    const options: SequelizeOptions = {
      database: this._options.dbName,
      dialect: params.sqlEngine,
      host: params.hostname || 'localhost',
      logging: params.logging ?
        Server.logger.info : false,
      password: params.password,
      pool: {
        acquire: 1000 * 60 * 5,// 5 min
        idle: 10000,
        max: 10,
        min: 1,
      },
      port: port,
      storage: params.sqliteStoragePath,
      username: params.user,
    };

    switch (options.dialect) {
      case 'mysql' :
        options.dialectOptions = {
          socketPath: params.proxy,
          connectTimeout: 1000 * 60 * 5,// 5 minutes
          decimalNumbers: params.mysqlDecimalNumbers,
        };
        break;
      case 'mssql' :
        // tslint:disable-next-line: no-shadowed-variable
        DataType.DATE.prototype._stringify = function _stringify(date: any, options: any): string {
          return this._applyTimezone(date, options).format('YYYY-MM-DD HH:mm:ss.SSS');
        };

        options.dialectOptions = {
          instanceName: this._options.instanceName,
        };
        break;
      default :
    }

    this.sequelize = new Sequelize(options);
  }
  
  /**
   * @description must await call _init as first instruction
   */
  public abstract async init(): Promise<void>;
}
