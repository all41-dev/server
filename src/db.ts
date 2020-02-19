import { DataType, Sequelize, SequelizeOptions } from 'sequelize-typescript';
import { IServerDbInstOptions } from './interfaces';
import { Server } from './server';

export abstract class Db {
  public static inst: Db;
  public sequelize!: Sequelize;
  private _options: IServerDbInstOptions;
  public constructor(options: IServerDbInstOptions) {
    this._options = options;

    this._sequelizeConnect();
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
  
  protected _sequelizeConnect(): void {
    if (process.env.SQL_ENGINE === 'sqlite' && process.env.SQLITE_STORAGE_PATH === undefined) {
      throw new Error('When db engine is sqlite, sqliteStoragePath must be set. Aborting..');
    }
    const engine: 'mysql' | 'postgres' | 'mssql' | 'sqlite' | 'mariadb' | undefined =
      // tslint:disable-next-line: max-line-length
      (this._options.engine || process.env.SQL_ENGINE) as 'mysql' | 'postgres' | 'mssql' | 'sqlite' | 'mariadb' | undefined;
    if (!engine || ['mysql', 'postgress', 'mssql', 'sqlite', 'mariadb'].indexOf(engine) === -1) {
      throw new Error(`unexpected DB engine ${engine}`);
    }
    const options: SequelizeOptions = {
      database: this._options.dbName,
      dialect: engine,
      host: this._options.hostname || process.env.SQL_HOSTNAME,
      logging: process.env.DEFAULT_DB_LOGGING && process.env.DEFAULT_DB_LOGGING.toLowerCase().trim() === 'true' ?
        Server.logger.info : false,
      password: this._options.password,
      pool: {
        acquire: 1000 * 60 * 5,// 5 min
        idle: 10000,
        max: 10,
        min: 1,
      },
      port: this._options.port || (process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined),
      storage: this._options.sqliteStoragePath || process.env.SQLITE_STORAGE_PATH,
      username: this._options.username,
    };

    switch (options.dialect) {
      case 'mysql' :
        options.dialectOptions = {
          socketPath: process.env.GOOGLE_CLOUD_SQL_CONNECTION_NAME ? `/cloudsql/${process.env.GOOGLE_CLOUD_SQL_CONNECTION_NAME}` : undefined,
          connectTimeout: 1000 * 60 * 5,
          decimalNumbers: process.env.MYSQL_DECIMAL_NUMBERS === 'true' || false,
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
