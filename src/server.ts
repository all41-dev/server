require('dotenv').config();

import express, { Router } from 'express';
import * as http from 'http';
import { IServerApiOptions, IServerDbOptions, IServerJobOptions, IServerOptions, IServerUiOptions, IAuthOptions, IServerStaticOptions } from './interfaces';
import { CronJob } from 'cron';
import winston from 'winston';
import { Db } from './db';
import { auth, requiresAuth } from "express-openid-connect";
import session from "express-session";
import bearerToken from "express-bearer-token";
import JwtDecode from "jwt-decode";
const memoryStore = require('memorystore')(session);
/**
 * @description hosts all microservice functionalities
 */
export class Server {
  private static _logger: winston.Logger;

  public http!: http.Server;

  // public sequelize!: Sequelize.Sequelize;
  protected options: IServerOptions;
  protected readonly _app: express.Application = express();
  protected readonly _routes: {router: Router; path: string; requireAuth: boolean}[] = [];
  protected readonly _jobs: {
    instance: CronJob;
    options: {execOnStart: boolean};
  }[] = [];
  protected readonly _dbs: Db[] = [];

  public get app(): express.Application {
    return this._app;
  }

  public static get logger(): winston.Logger { return Server._logger;}

  public constructor(options: IServerOptions) {
    this.options = options;
    Server._logger = winston.createLogger(options.loggerOptions);
    //
    // If we're not in production then **ALSO** log to the `console`
    // with the colorized simple format.
    //
    if (process.env.NODE_ENV !== 'production') {
      Server._logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.errors(),
        ), level: options.consoleLogLevel || 'debug',
      }));
    }

    // register dbs
    if (options.dbs) {
      const dbArray = Array.isArray(options.dbs) ? options.dbs : [options.dbs];

      for (const db of dbArray) { this._registerDb(db); }
    }

    if(options.auth) {
      this._registerAuth(options.auth);
    }

    // register uis
    if (options.uis) {
      const uiArray = Array.isArray(options.uis) ? options.uis : [options.uis];

      for (const ui of uiArray) {
        if (!options.auth) { ui.requireAuth = false; }
        this._registerUi(ui);
      }
    }

    // register apis
    if (options.apis) {
      const apiArray = Array.isArray(options.apis) ? options.apis : [options.apis];

      for (const api of apiArray) {
        if (!options.auth) { api.requireAuth = false; }
        this._registerApi(api);
      }
    }

    // register static
    if (options.statics) {
      const staticArray = Array.isArray(options.statics) ? options.statics : [options.statics];

      for (const stat of staticArray) {
        if (!options.auth) { stat.requireAuth = false; }
        this._registerStatic(stat);
      }
    }

    // register jobs
    if (options.jobs) {
      const jobArray = Array.isArray(options.jobs) ? options.jobs : [options.jobs];

      for (const job of jobArray) { this._registerJob(job); }
    }
  }

  public async stop(): Promise<void> {
    if (!this.http) {
      throw new Error('http server not started');
    }
    await new Promise((ok): void => {
      this.http.close((): void => {
        Server.logger.info({
          message: 'server stopped',
          hash: 'server-state',
        });
        ok();
      });
    });
    for(const job of this._jobs) { job.instance.stop(); }
  }
  public async start(skipJobs = false, port = 8080): Promise<void> {
    for(const db of this._dbs) { await db.init(); }
    await new Promise<void>((ok): void => {
      /** @description sort longest route (most slashes) as a "/" route would catch all requests */
      const sortedRoutes = this._routes.sort((a, b) => {
        const aSlashs = (a.path.match(/\//g) || []).length;
        const bSlashs = (b.path.match(/\//g) || []).length;
        if (aSlashs > bSlashs) return 2;
        if (aSlashs < bSlashs) return 0;

        if (a.path.length > b.path.length) return 2;
        if (a.path.length < b.path.length) return 0;
        return 1;
      });
      
      for (const route of sortedRoutes) {
        if (route.requireAuth) { this._app.use(route.path, requiresAuth(), route.router); }
        else { this._app.use(route.path, route.router); }
      }
  
      this.http = this._app.listen(port, (): void => {
        Server.logger.info({
          message: `Api listening on port ${port}!`,
          hash: 'api-state',
        });
        ok();
      });
    });
    if (!skipJobs) {
      await this.startJobs();
    }
    
    Server.logger.info('Server started');
  }

  public async startJobs(): Promise<void> {
    for(const job of this._jobs) { 
      job.instance.start();
      if (job.options.execOnStart) { job.instance.fireOnTick(); }
    }
  }

  protected _registerStatic(staticOptions: IServerStaticOptions): void {
    const router = Router();

    router.use('/', express.static(staticOptions.ressourcePath));
    
    this._routes.push({
      router: router,
      path: staticOptions.baseRoute,
      requireAuth: staticOptions.requireAuth || false});
    // if (ui.requireAuth) { this._app.use(ui.baseRoute, requiresAuth(), uiInst); }
    // else { this._app.use(ui.baseRoute, uiInst); }
  }

  protected _registerUi(ui: IServerUiOptions): void {
    const uiInst = ui.instance.init({
      config: ui.config,
    });
    this._routes.push({router: uiInst, path: ui.baseRoute, requireAuth: ui.requireAuth || false})
    // if (ui.requireAuth) { this._app.use(ui.baseRoute, requiresAuth(), uiInst); }
    // else { this._app.use(ui.baseRoute, uiInst); }
  }

  protected _registerApi(apiOpt: IServerApiOptions): void {
    const api = apiOpt.instance.init({
      baseRoute: apiOpt.baseRoute,
      config: apiOpt.config,
      requireAuth: apiOpt.requireAuth,
    });
    this._routes.push({router: api, path: apiOpt.baseRoute, requireAuth: apiOpt.requireAuth || false})
    // if (apiOpt.requireAuth) { this._app.use(apiOpt.baseRoute, requiresAuth(), api); }
    // else { this._app.use(apiOpt.baseRoute, api); }
  }

  protected _registerDb(dbOpt: IServerDbOptions): void {
    this._dbs.push(...(Array.isArray(dbOpt.instance) ? dbOpt.instance : [dbOpt.instance]));
  }
  protected _registerJob(jobOpt: IServerJobOptions): void {
    this._jobs.push({instance: new CronJob({
      cronTime: jobOpt.schedule,
      onTick: jobOpt.function,
      runOnInit: false,
      start: false,
      context: jobOpt.context,
    }), options: { execOnStart: jobOpt.executeOnStart}});
    Server.logger.info({
      message: `Job ${jobOpt.name} referenced.`,
      hash: 'job-state',
    });
  }

  protected _registerAuth(authOptions: IAuthOptions): void {
    this._app.use(
      session({
        secret: "should this be set?",
        resave: true, 
        saveUninitialized: false,
        store: new memoryStore({checkPeriod: 86400000}),
      }),
      bearerToken(),
      (req: any, _res: any, next: any) => {
        if ( req.token) {
          req.session.openidTokens = JwtDecode(req.token);
          // eslint-disable-next-line @typescript-eslint/camelcase
          req.session.openidTokens.id_token = req.token;
        }
        next();
      },
      auth(authOptions),
    );
    // return current token
    this._app.get("/token", requiresAuth(), async (req: any, res: any, next: any) => {
      let tokenSet = req.openid.tokens;
      if (tokenSet.expired() && tokenSet.refresh_token) {
        try {
          tokenSet = await req.openid.client.refresh(tokenSet);
        } catch (err) {
          next(err);
        }
        // eslint-disable-next-line @typescript-eslint/camelcase
        tokenSet.refresh_token = req.openid.tokens.refresh_token;
        req.openid.tokens = tokenSet;
      }
      res.json(tokenSet);
    });
    this._app.get('/user', requiresAuth(), (req: any, res: any) => res.json(req.openid.user));
    this._app.get('/logout', requiresAuth(), (_req: any, res: any) => res.openid.logout());
    this._app.get('/login',requiresAuth(), (_req: any, res: any) => res.openid.login());
  }
}
