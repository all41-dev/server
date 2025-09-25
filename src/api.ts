
import express from 'express';
import { IApiOptions } from './interfaces';

export abstract class Api<T extends Api<T>> {

  public static inst: Api<any>;
  public router: express.Router;
  protected _options: IApiOptions<Api<T>>;

  public constructor(options: IApiOptions<Api<T>>) {
    this._options = options;
    this.setStaticInst();
    this.router = this.createRouter();
  }

  protected createRouter(): express.Router {
    

    const router = express.Router();
    router.use(express.json({ limit: '6mb' }));
    router.use(express.urlencoded({ extended: true }));
    return router;
  }

  public abstract init(): express.Router;

  public abstract setStaticInst(): void;
}
