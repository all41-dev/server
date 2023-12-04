/* eslint-disable @typescript-eslint/member-ordering */
import { Request, Response, Router } from 'express';
import { ControllerBase } from './controller-base';
import { IPkName, IRepositoryReadable, IRepositoryWritable, Repository } from '../repository/repository';
import { Utils } from '../utils';

export class ControllerRepository<R extends Repository<T> & IRepositoryReadable<T> & IRepositoryWritable<T>, T extends IPkName<T> = any> extends ControllerBase {
  private _repository!: R;

  constructor() {
    super();
    this.routes.push(...new ControllerRepositoryReadonly<T, R>().routes);
    this.routes.push(...new ControllerRepositoryWriteonly<T, R>().routes);
  }
  public create(repoType: R | (new () => R), router?: Router) {
    this._repository = typeof repoType === 'object' ? repoType : new repoType();
    const usedRouter = super.createBase(router);

    return usedRouter;
  }
}

export class ControllerRepositoryReadonly<T extends IPkName<T>, R extends Repository<T> & IRepositoryReadable<T>> extends ControllerBase {
  private _repository!: R;

  public constructor() {
    super();
    this.routes.push(
      { verb: 'get', path: "/", handlers: this.getAll },
      { verb: 'get', path: '/:id', handlers: this.getById },
    );
  }

  public create(repoType: new () => R, router?: Router) {
    this._repository = new repoType();
    const usedRouter = super.createBase(router);

    return usedRouter;
  }

  public async getAll(req: Request, res: Response): Promise<void> {
    try {
      const include = req.query.include;
      const where = req.query.filter;// TODO will probably not work "as is"
      const options = where || include ? { where, include } : undefined;

      const result = await this._repository.get(options);
      res.json(result);
    } catch (err: unknown) {
      Utils.inst.handleCatch(err as Error, res);
    }
  }

  public async getById(req: Request, res: Response): Promise<void> {
    try {
      const include = req.query.include;
      const options = include ? { include } : undefined;
      const result = await this._repository.getByKey(req.params.id, options);

      res.json(result);
    } catch (err: unknown) {
      Utils.inst.handleCatch(err as Error, res);
    }
  }
}

export class ControllerRepositoryWriteonly<T extends IPkName<T>, R extends Repository<T> & IRepositoryWritable<T>> extends ControllerBase {
  private _repository!: R;

  public constructor() {
    super();
    this.routes.push(
      { verb: 'post', path: "/", handlers: this.post },
      { verb: 'patch', path: "/:id", handlers: this.patch },
      { verb: 'delete', path: "/:id", handlers: this.delete },
    );
  }
  public create(repoType: new() => R, router?: Router) {
    this._repository = new repoType();
    const usedRouter = super.createBase(router);

    return usedRouter;
  }

  public async post(req: Request, res: Response): Promise<void> {
    try {
      const include = req.query.include;
      const options = include ? { include } : undefined;

      const result = await this._repository.post(req.body, options);
      res.json(result);
    } catch (err: unknown) {
      Utils.inst.handleCatch(err as Error, res);
    }
  }

  public async patch(req: Request, res: Response): Promise<void> {
    try {
      const include = req.query.include;
      const options = include ? { include } : undefined;

      const result = await this._repository.patch(req.params.id, req.body, options);
      res.json(result);
    } catch (err: unknown) {
      Utils.inst.handleCatch(err as Error, res);
    }
  }

  public async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await this._repository.delete(req.params.id);
      res.json(result);
    } catch (err: unknown) {
      Utils.inst.handleCatch(err as Error, res);
    }
  }
}
