import { DestroyOptions, FindOptions, Utils } from 'sequelize';
import { Model } from 'sequelize-typescript';

export type PkPropType = { [key: string|number]: any; pkPropName: keyof PkPropType & string; };
export abstract class EntityRequest<T1 extends Model<T1>, T2 extends PkPropType> {
  protected _findOptions: FindOptions = {};
  private _dbType: (new (values?: Utils.MakeNullishOptional<T1>) => T1);
  private _modelType: new () => T2;
  
  public constructor(dbType: new (values?: Utils.MakeNullishOptional<T1>) => T1, modelType: new () => T2) {
    this._dbType = dbType;
    this._modelType = modelType;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  protected static copyProps<T3>(from: any, to: Partial<T3>, props: (keyof T3)[]): Partial<T3> {
    for (const pid in props) {
      const pName = props[pid];
      to[pName] = from[pName];
    }
    return to;
  }


  /**
   * @description get by primary key
   * @param pkValue is autonumber or uuid or unique code
   */
  public async get(pkValue?: number | string): Promise<T2[]> {
    if (pkValue) {
      this._findOptions.where = {
        [(this._dbType as any).primaryKeyAttribute]: pkValue,
      };
    }
    return this.dbFindAll(this._findOptions).then((dbes): Promise<T2[]> =>
      Promise.all(dbes.map((dbe): Promise<T2> => this.dbToClient(dbe))));
  }

  public async post(obj: T2): Promise<T2> {
    return await this.preCreation(obj).then( async (obj1): Promise<T2> => {
      const dbProps: any = await this.clientToDb(obj1);
      const dbObj = new this._dbType(dbProps.dataValues);
      const savedInst = await dbObj.save(this._findOptions);
      const postProcessed = await this.postCreation(savedInst);
      const clientObj = await this.dbToClient(postProcessed);
      return clientObj;
      // (err) => { throw new Error(`insert failed => ${err}`); });
    }).catch((err) => { throw new Error(`insert failed => ${err}`); });
  }

  public async patch(params: {
    receivedObj: T2;
    fields?: (keyof T1)[];
    keyValue: string
  }): Promise<T2> {
    if (!params.receivedObj) throw new Error('receivedObj is not set for patch request');
    if (!params.keyValue) throw new Error('keyValue is not set for patch request');

    return await this.preUpdate(params.receivedObj).then(async (): Promise<T2> => {
      try {
        const clientObj = this.initForPatch({ initialValues: params.receivedObj, pkValue: params.keyValue });
        const dbObj: T1 = await this.clientToDb(clientObj);
        const savedObj = await (params.fields ? dbObj.save({ fields: params.fields }) : dbObj.save());
        const res = await this.dbToClient(savedObj);
        return res;
      } catch (err) {
        throw new Error(`update failed => ${err}`);
      }
    }).catch((err) => { throw new Error(`update failed => ${err}`); });
  }

  public async del(id: number|string): Promise<void> {
    const options: DestroyOptions = {
      where: { [(this._dbType as any).primaryKeyAttribute]: id }
    };

    try {
      await this.preDelete(id);
      this.dbDestroy(options)
    } catch (err) {
      throw new Error(`delete failed => ${err}`);
    }
  }
  
  protected async dbFindAll(options: FindOptions): Promise<T1[]> {
    return await (this._dbType as any).findAll(options);
  }
  protected async dbFindByPk(pk: any): Promise<T1 | null> {
    return await (this._dbType as any).prototype.findByPk(pk);
  }
  protected async dbDestroy(options: DestroyOptions): Promise<number> {
    return await (this._dbType as any).prototype.destroy(options);
  }

  private initForPatch(options: { initialValues?: string | T2/* as an interface */, pkValue?: any }): T2 {
    const obj = new this._modelType;
    if (options.initialValues) {
      const initialValuesObj = typeof options.initialValues === 'string' ?
        JSON.parse(options.initialValues) as { [key: string]: any } :
        options.initialValues;
      Object.assign(obj, initialValuesObj);
    }
    if (options.pkValue) {
      obj[obj.pkPropName as any] = options.pkValue;
    }
    return obj;
  }
  
  public abstract dbToClient(dbObj: T1): Promise<T2>;
  public abstract clientToDb(clientObj: T2): Promise<T1>;
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public abstract setFilter(opt: any): void;
  public abstract preCreation(obj: T2): Promise<T2>;
  public abstract preUpdate(obj: T2): Promise<T2>;
  public abstract preDelete(id: number|string): Promise<number>;
  public abstract postCreation(obj: T1): Promise<T1>;
  public abstract setIncludes(includePaths: string[]): void;
}
