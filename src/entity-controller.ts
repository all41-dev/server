import { Request, Response } from 'express';
import { Entity } from './entity';
import { ControllerBase } from './controller-base';

export abstract class EntityController extends ControllerBase {
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
}
