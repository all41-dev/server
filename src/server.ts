import minimist from 'minimist';
import AMQP from "amqplib";
const args = minimist(process.argv.slice(2));
// eslint-disable-next-line no-console
if (args.ENV_FILE_PATH) console.info(`Using config file: ${args.ENV_FILE_PATH}`);
args.ENV_FILE_PATH ?
  require('dotenv').config({ path: args.ENV_FILE_PATH}) :
  require('dotenv').config();
import express, { Router } from 'express';
import * as http from 'http';
import { IApiOptions, IJobOptions, IServerOptions, IUiOptions, IAuthOptions, IStaticRouteOptions, IAmqpOptions } from './interfaces';
import { CronJob } from 'cron';
import winston from 'winston';
import { Db, IDbOptions } from '@all41-dev/db-tools';
import { auth, requiresAuth } from "express-openid-connect";
import session from "express-session";
import bearerToken from "express-bearer-token";
import JwtDecode from "jwt-decode";
import { Api } from './api';
import { Ui } from './ui';
import os from 'os';
import { Repository } from './repository/repository';
import { Workflow, WorkflowContext } from './workflow/workflow';
import { WebSocketServer } from 'ws';

const memoryStore = require('memorystore')(session);
/**
 * @description hosts all microservice functionalities
 */
export class Server {
  public static instance: Server;
  private static _logger: winston.Logger;
  private static amqpTypes = ["fanout", "direct", "topic", "headers"];

  public http!: http.Server;

  // public sequelize!: Sequelize.Sequelize;
  protected options: IServerOptions;
  protected readonly _app: express.Application = express();
  protected readonly _routes: {router: Router; path: string; requireAuth: boolean}[] = [];
  protected readonly _jobs: {
    instance: CronJob;
    code: string;
    name: string;
    isScheduled?: boolean;
    options: {execOnStart: boolean};
  }[] = [];
  protected readonly _dbs: Db<any>[] = [];
  protected readonly _amqp: {[key : string] : IAmqpOptions} = {};
  protected readonly _repositories: { [key: string]: Repository<any> } = {};
  protected readonly _workflows: { [key: string]: new(context: WorkflowContext) => Workflow<any> } = {};
  protected readonly _websockets: { [key: string]: WebSocketServer } = {};
  private readonly _apiArray: IApiOptions<Api<any>>[] = [];

  public constructor(options: IServerOptions) {
    Server.instance = this;
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

        for (const db of dbArray) {
          if (this.options.mute) db.mute = true;
          this._registerDb(db);
        }
      }

      if (options.auth) {
        this._registerAuth(options.auth);
      }

      // register uis
      if (options.uis) {
        const uiArray = Array.isArray(options.uis) ? options.uis : [options.uis];

        for (const ui of uiArray) {
          if (this.options.mute) ui.mute = true;
          if (!options.auth) { ui.requireAuth = false; }
          this._registerUi(ui);
        }
      }

      this._repositories = options.repositories || {};
      this._workflows = options.workflows || {};
      this._websockets = options.websockets || {};

      // register apis
      if (options.apis) {
        this._apiArray = Array.isArray(options.apis) ? options.apis : [options.apis];
      }

      // register static
      if (options.statics) {
        const staticArray = Array.isArray(options.statics) ? options.statics : [options.statics];

        for (const stat of staticArray) {
          if (this.options.mute) stat.mute = true;
          if (!options.auth) { stat.requireAuth = false; }
          this._registerStatic(stat);
        }
      }

      // register jobs
      if (options.jobs) {
        const jobArray = Array.isArray(options.jobs) ? options.jobs : [options.jobs];

        for (const job of jobArray) {
          if (this.options.mute) job.mute = true;
          this._registerJob(job);
        }
      }

      // register amqp
      if (options.amqp) {
        this._amqp = options.amqp;
      }

    } catch (error) {
      Server.logger.log('crit', (error as Error).message, {
        error: error,
        title: 'error while building all41 server',
        body: 'exception thrown in all41.server.Server constructor\nServer is stopped',
        options,
      })
    }
  }

  public static get logger(): winston.Logger { return Server._logger; }

  public get repositories(): { readonly [key: string]: Repository<any> } { return this._repositories; }
  public get workflows(): { readonly [key: string]: new(context: WorkflowContext) => Workflow<any> } { return this._workflows; }
  public get websockets(): { readonly [key: string] : WebSocketServer } {return this._websockets; }
  public get httpPort(): number | undefined { return this.options.httpPort; }
  public get app(): express.Application {
    return this._app;
  }
  public get dbs(): Db<any>[] { return this._dbs || []; }
  public get amqp(): {[key : string] : IAmqpOptions} { return this._amqp; }

  public async stop(killProcess = true): Promise<void> {
    if (this.http) {
      await new Promise<void>((ok): void => {
        this.http.close((): void => {
          Server.logger.info({
            message: `server stopped on ${os.hostname}`,
            hash: 'server-state',
          });
          ok();
        });
      });
    }
    if (this._jobs) {
      for (const job of this._jobs) { job.instance.stop(); }
    }
    if (this._dbs) {
      for (const db of this._dbs) { try { await db.sequelize.close(); } catch { Server.logger.info('Error closing db: continue stop'); }}
    }
    if (killProcess) process.exit(0);
  }
  public async restart(): Promise<void> {

    if (!this.http) {
      throw new Error('http server not started');
    }
    Server.logger.info('restarting server');
    await this.stop(false);
    await new Promise<void>((ok): void => {
      this._app.listen(this.httpPort, () => {
        Server.logger.info('Restart successful.')
        ok();
      })
    });
    for(const job of this._jobs) { job.instance.stop(); }
  }
  public async start(): Promise<void> {
    try {
      for (const db of this._dbs) { await db.init(); }
      for (const api of this._apiArray) { 
        if (this.options.mute) api.mute = true;
        if (!this.options.auth) { api.requireAuth = false; }
        this._registerApi(api);
      }
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
          if (!this.options.mute) {
            Server.logger.info({
              message: `${os.hostname} App listening on port ${this.options.httpPort}`,
              hash: 'api-state',
            });
          }
          ok();
        });
      });
      if (!this.options.skipJobScheduleAtStartup) {
        await this.scheduleJobs(this.options.mute);
      }

      if (!this.options.mute) {
        Server.logger.info(`Server started on ${os.hostname}`);
      }

      process.on('SIGINT', this.stop);
      process.on('SIGTERM', this.stop);
    } catch (error) {
      Server.logger.log('crit', (error as Error).message, {
        error,
        title: 'error while starting all41 server',
        body: 'exception thrown in all41.server.Server.start()\nServer is stopped',
        server: this,
      })
    }
  }

  public scheduleJobs(mute = false): void {
    for(const job of this._jobs) {
      job.instance.start();
      job.isScheduled = true;
      if (!mute) {
        Server.logger.info(`job ${job.name} scheduled`);
      }
      if (job.options.execOnStart) {
        job.instance.fireOnTick();
        if (!mute) {
          Server.logger.info(`job ${job.name} execution started`);
        }
      }
    }
  }

  public unscheduleJobs(): void {
    for(const job of this._jobs) {
      job.instance.stop();
      job.isScheduled = false;
      Server.logger.info(`job ${job.name} unscheduled`);
    }
  }
  public unscheduleJob(code: string): void {
    const job = this._jobs.find((j) => j.code === code);
    if (!job) throw new Error(`job '${code}' not found, can't be stopped.`);
    job.instance.stop();
    job.isScheduled = false;
    Server.logger.info(`job ${job.name} unscheduled`);
  }

  public scheduleJob(code: string, doExecute = false): void {
    const job = this._jobs.find((j) => j.code === code);
    if (!job) throw new Error(`job '${code}' not found, can't be started.`);
    job.instance.start();
    job.isScheduled = true
    Server.logger.info(`job ${job.name} scheduled`);
    if (doExecute) {
      job.instance.fireOnTick();
      Server.logger.info(`job ${job.name} execution started`);
    }
  }

  public async executeJob(code: string): Promise<any> {
    try {
      const job = this._jobs.find((j) => j.code === code);
      if (!job) throw new Error(`job '${code}' not found, can't be executed.`);
      const resp = job.instance.fireOnTick();
      Server.logger.info(`job ${job.name} ad-hoc execution started`);
      return resp;
    } catch (err: unknown) {
      const error = err as Error;
      Server.logger.error(error.message, error);
    }
  }
  public isJobScheduled(code: string): boolean {
    const job = this._jobs.find((j) => j.code === code);
    // if (!job) throw new Error(`job '${code}' not found`);
    return !!job?.isScheduled || false;
  }
  public isJobRunning(code: string): boolean {
    const job = this._jobs.find((j) => j.code === code);
    if (!job) throw new Error(`job '${code}' not found`);
    return job.instance.running || false;
  }

  public getAmqpUrl(id : string) : AMQP.Options.Connect {
    if(!this._amqp) throw new Error('amqp not initialized');
    if(!this._amqp[id]) throw new Error(`amqp '${id}' not found`);
    return this._amqp[id].params;
  }

  public getAmqpChannelNames(id : string) : string[] {
    if(!this._amqp) throw new Error('amqp not initialized');
    if(!this._amqp[id]) throw new Error(`amqp '${id}' not found`);
    return Object.keys(this._amqp[id].channels);
  }


  public amqpConnect(id : string) : Promise<void> {
    return new Promise(async(resolve, reject) => {
      if(!this._amqp[id]) reject(new Error(`amqp '${id}' not found`));
      try {
        this._amqp[id].connection = await AMQP.connect(this._amqp[id].params);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async amqpDisconnect(id : string) : Promise<void> {
    return new Promise(async(resolve, reject) => {
      if (!this._amqp[id]) {
        reject(Error(`amqp '${id}' not found`));
      }
      if (this._amqp[id].connection) {
        try {
          await this._amqp[id].connection?.close();
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    });
  }

  async amqpCreateChannel(id : string, name: string) : Promise<void> {
    return new Promise(async(resolve, reject) => {
      if (!this._amqp[id]) {
        reject(new Error(`amqp '${id}' not found`));
      }

      if (!this._amqp[id].connection) {
        reject(new Error("No connection"));
      }

      if (this._amqp[id].channels[name]) {
        resolve();
      }

      try {
        const con = this._amqp[id].connection;
        if (!con) throw new Error('the amqp connection should exist');
        const channel = await con.createChannel();
        this._amqp[id].channels[name] = channel;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async amqpDeleteChannel(id : string, name: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if(!this._amqp[id]) reject(new Error(`amqp '${id}' not found`));
      if (!this._amqp[id].connection) {
        reject(new Error("No connection"));
      }

      if (!this._amqp[id].channels[name]) {
        reject(new Error(`amqp channel '${name}' not found`));
      }

      try {
        await this._amqp[id].channels[name].close();
        delete this._amqp[id].channels[name];
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async amqpCreateExchange(id : string, channel: string, name: string, type: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].connection) {
        reject(new Error("No connection"));
      }

      if (!this._amqp[id].channels[channel]) {
        reject(new Error(`amqp channel '${channel}' not found`));
      }

      if (!Server.amqpTypes.includes(type)) {
        reject(new Error(`amqp type '${type}' not found`));
      }

      try {
        await this._amqp[id].channels[channel].assertExchange(name, type, { durable: false });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async amqpDeleteExchange(id : string, name: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].connection) {
        reject(new Error("No connection"));
      }

      if (!this._amqp[id].channels[name]) {
        reject(new Error(`amqp channel '${name}' not found`));
      }

      try {
        await this._amqp[id].channels[name].deleteExchange(name);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async amqpCreateQueue(id : string, channel: string, name: string, exchange: string, pattern?: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].channels[channel]) {
        reject(new Error(`amqp channel '${channel}' not found`));
      }
      try {
        await this._amqp[id].channels[channel].assertQueue(name, { durable: false });
      } catch (error) {
        reject(error);
      }
      try {
        if (pattern != null) {
          await this._amqp[id].channels[channel].bindQueue(name, exchange, pattern);
        } else {
          await this._amqp[id].channels[channel].bindQueue(name, exchange, "");
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async amqpDeleteQueue(id : string, channel: string, name: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if(!this._amqp[id]) reject(new Error(`amqp '${id}' not found`));
      if (!this._amqp[id].channels[channel]) {
        reject(new Error(`amqp channel '${channel}' not found`));
      }
      try {
        await this._amqp[id].channels[channel].deleteQueue(name);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async amqpSend(id : string, channel: string, exchange : string, routingKey: string, message: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].channels[channel]) {
        reject(new Error(`amqp channel '${channel}' not found`));
      }
      try {
        this._amqp[id].channels[channel].publish(exchange, routingKey, Buffer.from(message));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async amqpReceive(id : string, channel: string, queue: string, onMessage : any, maxNumber? : number) : Promise<string> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].channels[channel]) {
        reject(new Error(`amqp channel '${channel}' not found`));
      }
      try {
        if (maxNumber) {
          await this._amqp[id].channels[channel].prefetch(maxNumber);
        }
        await this._amqp[id].channels[channel].consume(queue, onMessage, { noAck: false });
      } catch (error) {
        reject(error);
      }
    });
  }

  async amqpGetChannel(id : string, channel: string) : Promise<any> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].channels[channel]) {
        reject(new Error(`amqp channel '${channel}' not found`));
      }
      resolve(this._amqp[id].channels[channel]);
    });
  }


  protected _registerStatic(staticOptions: IStaticRouteOptions): void {
    const router = Router();

    router.use('/', express.static(staticOptions.ressourcePath));
    staticOptions.getRoutes?.forEach((route: { path: string; handler: (req: any, res: any) => void }) => {
      router.get(route.path, route.handler);
    });

    this._routes.push({
      router,
      path: staticOptions.baseRoute,
      requireAuth: staticOptions.requireAuth || false
    });

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
    }), code: jobOpt.code || jobOpt.name, name: jobOpt.name, isScheduled: false, options: { execOnStart: jobOpt.executeOnStart }
    });
    if (!jobOpt.mute) {
      Server.logger.info({
        message: `Job ${jobOpt.name} referenced on ${os.hostname}.`,
        hash: 'job-state',
      });
    }
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
