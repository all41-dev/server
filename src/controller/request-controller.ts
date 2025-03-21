/* eslint-disable @typescript-eslint/member-ordering */
import { Request, Response, Router } from 'express';
import { EntityRequest, PkPropType } from '../entity-request';
import { ControllerBase } from '@all41-dev/server.types';
import { Model } from 'sequelize-typescript';
import { Server } from '../server';

/**
 * @example
 *
 * @deprecated Legacy class.
 * Use the new {ControllerRepository} base class from the 'all41-dev/server.types'.
 */
export class RequestController<ENT extends EntityRequest<Model, any & PkPropType>> extends ControllerBase {
  constructor(er: new () => ENT) {
    super();
    this.defineRoutes(
      { verb: 'get', path: '/', handlers: (req, res) => this.getAll(req, res, new er) },
      { verb: 'get', path: '/:id', handlers: (req, res) => this.getById(req, res, new er) },
      { verb: 'post', path: '/', handlers: (req, res) => this.post(req, res, new er) },
      { verb: 'patch', path: '/:id', handlers: (req, res) => this.patch(req, res, new er) },
      { verb: 'delete', path: '/:id', handlers: (req, res) => this.delete(req, res, new er) },
    )
  }

  public create(router?: Router) {
    const usedRouter = super.createBase(router);
    return usedRouter;
  }

  public async getAll(req: Request, res: Response, er: ENT): Promise<void> {
    er.setFilter(req.query.filter);
    er.setIncludes(req.query.include as any);

    return er.get()
      .then((data): PkPropType[] => {
        res.json(data);
        return data;
      })
      .catch((reason): any => {
        res.status(500).json(reason);
        Server.logger.error(reason);
        throw reason;
      });
  }
  public async getById(req: Request, res: Response, er: ENT): Promise<void> {
    er.setIncludes(req.query.include as any);

    return er.get(req.params.id)
      .then((data): void => { res.json(data) })
      .catch((reason): void => {
        res.status(500).json(reason);
        Server.logger.error(reason);
      });
  }
  public async post(req: Request, res: Response, er: ENT): Promise<void> {
    er.setIncludes(req.query.include as any);

    return er.post(req.body)
      .then((data): void => { res.json(data) })
      .catch((reason): void => {
        res.status(500).json(reason);
        Server.logger.error(reason);
      });
  }
  public async patch(req: Request, res: Response, er: ENT): Promise<void> {
    er.setIncludes(req.query.include as any);

    return er.patch({ receivedObj: req.body, keyValue: req.params.id, fields: req.query.fields as any })
      .then((data): void => { res.json(data) })
      .catch((reason): void => {
        res.status(500).json(reason);
        Server.logger.error(reason);
      });
  }
  public async delete(req: Request, res: Response, er: ENT): Promise<void> {
    return er.del(req.params.id)
      .then((): void => { res.send(); })
      .catch((reason): void => {
        res.status(500).json(reason);
        Server.logger.error(reason);
      });
  }
}
