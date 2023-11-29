import { Model, Repository as SequelizeNativeRepository } from 'sequelize-typescript';
import { FindOptions, BuildOptions, Utils as SQLUtils } from 'sequelize';
import { Server } from '../server';
import { IPkName, Repository, IRepositoryReadable, IRepositoryWritable } from './repository';
import { Utils } from "../utils";

export class RepositorySequelize<T extends Model<T> & IPkName<T>> implements Repository<T>, IRepositoryReadable<T>, IRepositoryWritable<T> {
  public readonly modelType: new (values?: SQLUtils.MakeNullishOptional<T> | Partial<T>, options?: BuildOptions) => T;
  public readonly dbName?: string;
  
  /**
   * 
   * @param type Model type
   * @param dbName database name (from Server.dbs.dbName value)
   */
  constructor(type: new (values?: SQLUtils.MakeNullishOptional<T> | Partial<T>, options?: BuildOptions) => T, dbName?: string) {
    this.modelType = type;
    this.dbName = dbName;
  }
  protected get _sequelizeRepository(): SequelizeNativeRepository<T> {
    const sequelizeRepository = Server.instance.dbs.find(db => this.dbName ? db.sequelize.getDatabaseName() === this.dbName : true)?.sequelize.getRepository(this.modelType);
    if (!sequelizeRepository) throw new Error(`Repository for '${this.modelType.prototype.constructor.name}' not found`);
    return sequelizeRepository;
  }
  post(object: T): Promise<T> {
    throw new Error('Method not implemented.');
  }
  delete(key: any): Promise<void> {
    throw new Error('Method not implemented.');
  }


  public async getByKey(key: any): Promise<T> {
    const result = await this._sequelizeRepository.findByPk(key);
    if (result === null) throw new Error(`No record found with key '${key} on repository '${this.modelType.constructor.name}`);
    Utils.DateToDateTime(result);
    return result;
  }
  public async get(options: FindOptions<T>): Promise<T[]> {
    const result = await this._sequelizeRepository.findAll(options);
    Utils.DateToDateTime(result);
    return result;
  }
  public async patch(key: any, object: Partial<T>): Promise<T> {
    const foundRecord = await this.getByKey(key);
    const result = await foundRecord.set(object).save();
    return result;
  }
}
