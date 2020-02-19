import * as bodyParser from 'body-parser';
import Cors from 'cors';
import express from 'express';
import { IApiOptions } from './interfaces';

export abstract class Api {

  public static inst: Api;
  public router: express.Router;

  public constructor() {
    this.setStaticInst();
    this.router = this.createRouter();
  }

  protected createRouter(): express.Router {
    const router = express.Router();
    router.use(bodyParser.json({ limit: '6mb' }));
    router.use(bodyParser.urlencoded({ extended: true }));
    router.use(Cors());
    return router;
  }

  public abstract init(options: IApiOptions): express.Router;

  public abstract setStaticInst(): void;
}
