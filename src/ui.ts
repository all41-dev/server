import express from 'express';
import * as path from 'path';
import { IUiOptions } from './interfaces';
import { requiresAuth } from "express-openid-connect";

// tslint:disable-next-line:no-var-requires
const hist = require('connect-history-api-fallback');

export abstract class UI {

  public static inst: UI;
  public router: express.Router;
  protected indexHtml!: string;

  public constructor() {
    UI.inst = this;
    this.router = this.createRouter();
  }

  public getBaseRouter(dir: string, options: IUiOptions): express.Router {

    // load angular config to resolve default project
    const angularConfig = require(path.resolve(dir, '../angular.json'));

    // return configuration
    this.router.use('/_config', (req: express.Request, res: express.Response): express.Response => {
      return res.json(options.config || {});
    });

    // read dist path with help of angular config
    const p = path.resolve(dir, './' + angularConfig.defaultProject);
    if (options.config && (options.config as any).requireAuth) { this.router.use('/', requiresAuth(), express.static(p)); }
    else { this.router.use('/', express.static(p)); }

    // add router to provided application
    return this.router;
  }

  protected createRouter(): express.Router {
    const router = express.Router();

    // enable history fallback for angular application
    router.use(hist({
      verbose: true,
    }));

    return router;
  }

  public abstract init(options: IUiOptions): express.Router;
}
