import minimist from 'minimist';
const args = minimist(process.argv.slice(2));
// eslint-disable-next-line no-console
if (args.ENV_FILE_PATH) console.info(`Using config file: ${args.ENV_FILE_PATH}`);
args.ENV_FILE_PATH ?
  require('dotenv').config({ path: args.ENV_FILE_PATH}) :
  require('dotenv').config();
import express, { Router } from 'express';
import * as http from 'http';
import { IApiOptions, IJobOptions, IServerOptions, IUiOptions, IAuthOptions, IStaticRouteOptions } from './interfaces';
import { CronJob, job } from 'cron';
import winston from 'winston';
import { Db, IDbOptions } from '@all41-dev/db-tools';
import { auth, requiresAuth } from "express-openid-connect";
import session from "express-session";
import bearerToken from "express-bearer-token";
import JwtDecode from "jwt-decode";
import { Api } from './api';
import { Ui } from './ui';
import os from 'os';
import { ok } from 'assert';

const memoryStore = require('memorystore')(session);
/**
 * @description hosts all microservice functionalities
 */
export class Server {
  private static _logger: winston.Logger;

  public http!: http.Server;
  public httpPort?: number;

  // public sequelize!: Sequelize.Sequelize;
  protected options: IServerOptions;
  protected readonly _app: express.Application = express();
  protected readonly _routes: {router: Router; path: string; requireAuth: boolean}[] = [];
  protected readonly _jobs: {
    instance: CronJob;
    code: string;
    options: {execOnStart: boolean};
  }[] = [];
  protected readonly _dbs: Db<any>[] = [];

  public get app(): express.Application {
    return this._app;
  }

  public static get logger(): winston.Logger { return Server._logger;}

  public constructor(options: IServerOptions) {
    this.options = options;
    try {
      if (!options.loggerOptions) options.loggerOptions = {};
      options.loggerOptions.levels = winston.config.syslog.levels;
      Server._logger = winston.createLogger(options.loggerOptions);
      //
      // If we're not in production then **ALSO** log to the `console`
      // with the colorized simple format.
      //
      if (process.env.NODE_ENV !== 'production') {
        Server._logger.add(new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(ev => `${ev.timestamp}> ${ev.level}: ${ev.message}`),
          // winston.format.errors(),
          ), level: options.consoleLogLevel || options.loggerOptions.level || 'debug',
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
    } catch (error) {
      Server.logger.log('crit', error, {
        title: 'error while building all41 server',
        body: 'exception thrown in all41.server.Server constructor\nServer is stopped'
      })
    }
  }

  public async stop(): Promise<void> {
    if (!this.http) {
      throw new Error('http server not started');
    }
    await new Promise((ok): void => {
      this.http.close((): void => {
        Server.logger.info({
          message: `server stopped on ${os.hostname}`,
          hash: 'server-state',
        });
        ok();
      });
    });
    for(const job of this._jobs) { job.instance.stop(); }
  }
  public async restart(): Promise<void> {
    if (!this.http) {
      throw new Error('http server not started');
    }
    Server.logger.info('restarting server');
    await this.stop();
    await new Promise((ok): void => {
      this._app.listen(this.httpPort, () => {
        Server.logger.info('Restart successful.')
        ok();
      })
    });
    for(const job of this._jobs) { job.instance.stop(); }
  }
  public async start(skipJobSchedules = false, port = 8080): Promise<void> {
    this.httpPort = port;
    try {
      for (const db of this._dbs) { await db.init(); }
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
  
        this.http = this._app.listen(this.httpPort, (): void => {
          Server.logger.info({
            message: `${os.hostname} Api listening on port ${port}!`,
            hash: 'api-state',
          });
          ok();
        });
      });
      if (!skipJobSchedules) {
        await this.scheduleJobs();
      }
    
      Server.logger.info(`Server started on ${os.hostname}`);
    } catch (error) {
      Server.logger.log('crit', error, {
        title: 'error while starting all41 server',
        body: 'exception thrown in all41.server.Server.start()\nServer is stopped'
      })
    }
  }

  public scheduleJobs(): void {
    for(const job of this._jobs) { 
      job.instance.start();
      Server.logger.info(`job ${job.code} unscheduled`);
      if (job.options.execOnStart) {
        job.instance.fireOnTick();
        Server.logger.info(`job ${job.code} execution started`);
      }
    }
  }

  public unscheduleJobs(): void {
    for(const job of this._jobs) { 
      job.instance.stop();
      Server.logger.info(`job ${job.code} unscheduled`);
    }
  }
  public unscheduleJob(code: string): void {
    const job = this._jobs.find((j) => j.code === code);
    if (!job) throw new Error(`job '${code}' not found, can't be stopped.`);
    job.instance.stop();
    Server.logger.info(`job ${code} unscheduled`);
  }

  public scheduleJob(code: string, doExecute = false): void {
    const job = this._jobs.find((j) => j.code === code);
    if (!job) throw new Error(`job '${code}' not found, can't be started.`);
    job.instance.start();
    Server.logger.info(`job ${code} scheduled`);
    if (doExecute) {
      job.instance.fireOnTick();
      Server.logger.info(`job ${code} execution started`);
    }
  }

  public executeJob(code: string): void {
    const job = this._jobs.find((j) => j.code === code);
    if (!job) throw new Error(`job '${code}' not found, can't be executed.`);
    job.instance.fireOnTick();
    Server.logger.info(`job ${code} ad-hoc execution started`);
  }

  public isJobActive(code: string): boolean {
    const job = this._jobs.find((j) => j.code === code);
    if (!job) throw new Error(`job '${code}' not found`);
    return job.instance.running || false;
  }

  protected _registerStatic(staticOptions: IStaticRouteOptions): void {
    const router = Router();

    router.use('/', express.static(staticOptions.ressourcePath));
    
    this._routes.push({
      router: router,
      path: staticOptions.baseRoute,
      requireAuth: staticOptions.requireAuth || false});
    // if (ui.requireAuth) { this._app.use(ui.baseRoute, requiresAuth(), uiInst); }
    // else { this._app.use(ui.baseRoute, uiInst); }
  }

  protected _registerUi(uiOpt: IUiOptions<Ui<any>>): void {
    const uiInst = new uiOpt.type(uiOpt).init();
    this._routes.push({router: uiInst, path: uiOpt.baseRoute, requireAuth: uiOpt.requireAuth || false})
    // if (ui.requireAuth) { this._app.use(ui.baseRoute, requiresAuth(), uiInst); }
    // else { this._app.use(ui.baseRoute, uiInst); }
  }

  protected _registerApi(apiOpt: IApiOptions<Api<any>>): void {
    const api = new apiOpt.type(apiOpt).init();
    this._routes.push({router: api, path: apiOpt.baseRoute, requireAuth: apiOpt.requireAuth || false})
    // if (apiOpt.requireAuth) { this._app.use(apiOpt.baseRoute, requiresAuth(), api); }
    // else { this._app.use(apiOpt.baseRoute, api); }
  }

  protected _registerDb(dbOpt: IDbOptions<Db<any>>): void {
    if (!dbOpt.logger && Server._logger) dbOpt.logger = Server._logger;
    this._dbs.push(new dbOpt.type(dbOpt));
  }
  protected _registerJob(jobOpt: IJobOptions): void {
    this._jobs.push({instance: new CronJob({
      cronTime: jobOpt.schedule,
      onTick: jobOpt.function,
      runOnInit: false,
      start: false,
      context: jobOpt.context,
    }), code: jobOpt.name ,options: { execOnStart: jobOpt.executeOnStart}});
    Server.logger.info({
      message: `Job ${jobOpt.name} referenced on ${os.hostname}.`,
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
