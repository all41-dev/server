require('dotenv').config();

import express from 'express';
import * as http from 'http';
import { IServerApiOptions, IServerDbOptions, IServerJobOptions, IServerOptions, IServerUiOptions, IAuthOptions } from './interfaces';
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
        ), level: process.env.CONSOLE_LOG_LEVEL || 'debug',
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
  public async start(skipJobs = false): Promise<void> {
    for(const db of this._dbs) { await db.init(); }
    await new Promise<void>((ok): void => {
      this.http = this._app.listen(process.env.HTTP_PORT || 8080, (): void => {
        Server.logger.info({
          message: `Api listening on port ${process.env.HTTP_PORT || 8080}!`,
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
    if(process.env.SKIP_JOBS === 'true') { return; }
    for(const job of this._jobs) { 
      job.instance.start();
      if (job.options.execOnStart) { job.instance.fireOnTick(); }
    }
  }

  protected _registerUi(ui: IServerUiOptions): void {
    const uiInst = ui.instance.init({
      config: ui.config,
    });
    if (ui.requireAuth) { this._app.use(ui.baseRoute, requiresAuth(), uiInst); }
    else { this._app.use(ui.baseRoute, uiInst); }
  }

  protected _registerApi(apiOpt: IServerApiOptions): void {
    const api = apiOpt.instance.init({
      baseRoute: apiOpt.baseRoute,
      config: apiOpt.config,
      requireAuth: apiOpt.requireAuth,
    });
    if (apiOpt.requireAuth) { this._app.use(apiOpt.baseRoute, requiresAuth(), api); }
    else { this._app.use(apiOpt.baseRoute, api); }
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
