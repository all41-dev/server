import express from 'express';
import { IUiOptions } from './interfaces';
import * as hist from "connect-history-api-fallback";

export abstract class Ui<T extends Ui<T>> {

  public static inst: Ui<any>;
  public router: express.Router;
  protected indexHtml!: string;
  protected _options: IUiOptions<Ui<T>>;

  public constructor(options: IUiOptions<Ui<T>>) {
    this._options  = options;
    Ui.inst = this;
    this.router = this.createRouter();
  }

  public getBaseRouter(dir: string): express.Router {
    // return configuration
    this.router.use('/_config', (_req: express.Request, res: express.Response): express.Response => {
      return res.json(this._options.config || {});
    });

    // add router to provided application
    return this.router;
  }

  protected createRouter(): express.Router {
    const router = express.Router();

    // enable history fallback for angular application
    router.use(hist.default({
      verbose: true,
    }));

    return router;
  }

  public abstract init(): express.Router;
}
