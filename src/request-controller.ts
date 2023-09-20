/* eslint-disable @typescript-eslint/member-ordering */
import { Request, Response, Router } from 'express';
import { EntityRequest } from './entity-request';
import { ControllerBase } from './controller-base';
import { Model } from 'sequelize-typescript';
import { Server } from './server';

/**
 * @example .
 */
export class RequestController<T extends EntityRequest<Model, any>> extends ControllerBase {
  public create(er: new() => T) {
    const router = Router();
    const controler = new RequestController;

    router.get("/", (req, res) => controler.getAll(req, res, new er));
    router.get("/:id", (req, res) => controler.getById(req, res, new er));
    router.post("/", (req, res) => controler.post(req, res, new er));
    router.patch("/:id", (req, res) => controler.patch(req, res, new er));
    router.delete("/:id", (req, res) => controler.delete(req, res, new er));

    return router;
  }

  public async getAll(req: Request, res: Response, er: T): Promise<void> {
    er.setFilter(req.query.filter);
    er.setIncludes(req.query.include as any);

    return er.get()
      .then((data): void => {
        res.json(data);
      })
      .catch((reason): void => {
        res.status(500).json(reason);
        Server.logger.error(reason);
      });
  }
  public async getById(req: Request, res: Response, er: T): Promise<void> {
    er.setIncludes(req.query.include as any);

    return er.get(req.params.id)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        Server.logger.error(reason);
      });
  }
  public async post(req: Request, res: Response, er: T): Promise<void> {
    er.setIncludes(req.query.include as any);

    return er.post(req.body)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        Server.logger.error(reason);
      });
  }
  public async patch(req: Request, res: Response, er: T): Promise<void> {
    er.setIncludes(req.query.include as any);

    return er.patch(req.body)
      .then((data): void => {res.json(data)} )
      .catch((reason): void => {
        res.status(500).json(reason);
        Server.logger.error(reason);
      });
  }
  public async delete(req: Request, res: Response, er: T): Promise<void> {
    return er.del(req.params.id)
      .then((): void => { res.send(); } )
      .catch((reason): void => {
        res.status(500).json(reason);
        Server.logger.error(reason);
      });
  }
}
