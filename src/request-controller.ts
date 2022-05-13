/* eslint-disable @typescript-eslint/member-ordering */
import { Request, Response } from 'express';
import { EntityRequest } from './entity-request';
import { ControllerBase } from './controller-base';
import { Model } from 'sequelize-typescript';

/**
 * @example .
 */
export abstract class RequestController<T extends EntityRequest<Model, any>> extends ControllerBase {
  private _requestType: new () => T
  public constructor(entityType: new (dbType? : new(t1? : Model) => Model) => T) {
    super();
    this._requestType = entityType;
  }

  protected getNewRequest(): T {
    return new this._requestType();
  }

  public async getAll(req: Request, res: Response, er: EntityRequest<any, any>): Promise<void> {
    er.setFilter(req.query.filter);
    er.setIncludes(req.query.include as any);

    return er.get()
      .then((data): void => {
        res.json(data);
      })
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
  public async getById(req: Request, res: Response, er: EntityRequest<any, any>, key: string): Promise<void> {
    er.setIncludes(req.query.include as any);

    return er.get(req.params.id, key)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
  public async post(req: Request, res: Response, er: EntityRequest<any, any>): Promise<void> {
    er.setIncludes(req.query.include as any);

    return er.post(req.body)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
  public async update(req: Request, res: Response, er: EntityRequest<any, any>): Promise<void> {
    er.setIncludes(req.query.include as any);

    return er.put(req.body)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
  public async delete(req: Request, res: Response, er: EntityRequest<any, any>, key?: string): Promise<void> {
    return er.del(req.params.id, key)
      .then((): void => { res.send(); } )
      .catch((reason): void => {
        res.status(500).json(reason);
        throw new Error(reason);
      });
  }
}
