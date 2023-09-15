import { DestroyOptions, FindOptions, Utils } from 'sequelize';
import { Model } from 'sequelize-typescript';

export abstract class EntityRequest<T1 extends Model<T1>, T2> {
  protected _findOptions: FindOptions = {};
  private _dbType: (new (values?: Utils.MakeNullishOptional<T1>) => T1);

  public constructor(dbType: new (values?: Utils.MakeNullishOptional<T1>) => T1) { this._dbType = dbType; }

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
   * @param id is autonumber or uuid or unique code
   */
  public async get(id?: number|string, pk?: keyof T1): Promise<T2[]> {
    if (id) {
      const key = pk || 'Id';
      this._findOptions.where = {
        [key]: id,
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

  public async patch(receivedObj: T2, fields?: (keyof T1)[]): Promise<T2> {
    return await this.preUpdate(receivedObj).then(async (): Promise<T2> => {
      try {
        const dbObj: T1 = await this.clientToDb(receivedObj);
        const savedObj = await (fields ? dbObj.save({ fields }) : dbObj.save());
        const res = await this.dbToClient(savedObj);
        return res;
      } catch (err) {
        throw new Error(`update failed => ${err}`);
      }
    }).catch((err) => { throw new Error(`update failed => ${err}`); });
  }

  public async del(id: number|string, pk?: keyof T1): Promise<void> {
    const key = pk || 'Id';

    const options: DestroyOptions = { where: { [key]: id } };

    await this.preDelete(id).then(async (): Promise<number> => this.dbDestroy(options)).catch((err) => { throw new Error(`delete failed => ${err}`); });
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
