import { Request, Response } from 'express';
import { Entity } from './entity';
import { ControllerBase } from './controller-base';

/**
 * @description To be used through static methods or instanced.
 */
export abstract class EntityController<T extends Entity<any, any>> extends ControllerBase {
  /** @description To be set within create function */
  protected _entity?: T;
  // constructor(entity: T) {
  //   super();
  //   this._entity = entity;
  // }
  public static async getAll(req: Request, res: Response, entity: Entity<any, any>): Promise<void> {
    entity.setFilter(req.query.filter);
    entity.setIncludes(req.query.include);

    return entity.get()
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
  public static async getById(req: Request, res: Response, entity: Entity<any, any>, key: string): Promise<void> {
    entity.setIncludes(req.query.include);

    return entity.get(req.params.id, key)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
  public static async post(req: Request, res: Response, entity: Entity<any, any>): Promise<void> {
    return entity.post(req.body)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
  public static async update(req: Request, res: Response, entity: Entity<any, any>): Promise<void> {
    return entity.put(req.body)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
  public static async delete(req: Request, res: Response, entity: Entity<any, any>, key?: string): Promise<void> {
    return entity.del(req.params.id, key)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
  // public async getAll(req: Request, res: Response): Promise<void> {
  //   return EntityController.getAll(req, res, this._entity);
  // }
  // public async getById(req: Request, res: Response, key: string): Promise<void> {
  //   return EntityController.getById(req, res, this._entity, key);
  // }
  // public async post(req: Request, res: Response): Promise<void> {
  //   return EntityController.post(req, res, this._entity);
  // }
  // public async update(req: Request, res: Response): Promise<void> {
  //   return EntityController.update(req, res, this._entity);
  // }
  // public async delete(req: Request, res: Response, key?: string): Promise<void> {
  //   return EntityController.delete(req, res, this._entity, key);
  // }
}
