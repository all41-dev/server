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
import {
  IApiOptions,
  IJobOptions,
  IServerOptions,
  IUiOptions,
  IAuthOptions,
  IStaticRouteOptions,
  IAmqpOptions
} from './interfaces';
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

function sleep(ms : number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const memoryStore = require('memorystore')(session);
/**
 * @description hosts all microservice functionalities
 */
export class Server {
  private static _logger: winston.Logger;

  private static amqpTypes = ["fanout", "direct", "topic", "headers"];

  public http!: http.Server;
  public httpPort?: number;

  // public sequelize!: Sequelize.Sequelize;
  protected options: IServerOptions;
  protected readonly _app: express.Application = express();
  protected readonly _routes: {router: Router; path: string; requireAuth: boolean}[] = [];
  protected readonly _jobs: {
    instance: CronJob;
    code: string;
    isScheduled?: boolean;
    options: {execOnStart: boolean};
  }[] = [];
  protected readonly _dbs: Db<any>[] = [];
  protected readonly _amqp: {[key : string] : IAmqpOptions} = {};

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

      if (options.auth) {
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

  public get app(): express.Application {
    return this._app;
  }

  public async stop(killProcess = true): Promise<void> {
    if (!this.http) {
      throw new Error('http server not started');
    }
    await new Promise<void>((ok): void => {
      this.http.close((): void => {
        Server.logger.info({
          message: `server stopped on ${os.hostname}`,
          hash: 'server-state',
        });
        ok();
      });
    });
    for (const job of this._jobs) { job.instance.stop(); }
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
  public async start(port = 8080): Promise<void> {
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
      if (!this.options.skipJobScheduleAtStartup) {
        await this.scheduleJobs();
      }

      Server.logger.info(`Server started on ${os.hostname}`);
    } catch (error) {
      Server.logger.log('crit', (error as Error).message, {
        error,
        title: 'error while starting all41 server',
        body: 'exception thrown in all41.server.Server.start()\nServer is stopped',
        server: this,
      })
    }
  }

  public scheduleJobs(): void {
    for(const job of this._jobs) {
      job.instance.start();
      job.isScheduled = true;
      Server.logger.info(`job ${job.code} scheduled`);
      if (job.options.execOnStart) {
        job.instance.fireOnTick();
        Server.logger.info(`job ${job.code} execution started`);
      }
    }
  }

  public unscheduleJobs(): void {
    for(const job of this._jobs) {
      job.instance.stop();
      job.isScheduled = false;
      Server.logger.info(`job ${job.code} unscheduled`);
    }
  }
  public unscheduleJob(code: string): void {
    const job = this._jobs.find((j) => j.code === code);
    if (!job) throw new Error(`job '${code}' not found, can't be stopped.`);
    job.instance.stop();
    job.isScheduled = false;
    Server.logger.info(`job ${code} unscheduled`);
  }

  public scheduleJob(code: string, doExecute = false): void {
    const job = this._jobs.find((j) => j.code === code);
    if (!job) throw new Error(`job '${code}' not found, can't be started.`);
    job.instance.start();
    job.isScheduled = true
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

  public getAmqpUrl(id : string) : string {
    if(!this._amqp) throw new Error('amqp not initialized');
    if(!this._amqp[id]) throw new Error(`amqp '${id}' not found`);
    return this._amqp[id].AMQP_URL;
  }

  public getAmqpChannelNames(id : string) : string[] {
    if(!this._amqp) throw new Error('amqp not initialized');
    if(!this._amqp[id]) throw new Error(`amqp '${id}' not found`);
    return Object.keys(this._amqp[id].channels);
  }

  public amqpConnect(id : string) : Promise<void> {
    return new Promise(async(resolve, reject) => {
      try {
        this._amqp[id].connection = await AMQP.connect(this._amqp[id].AMQP_URL);
        resolve();
      } catch (error) {
        throw error;
      }
    });
  }

  async amqpDisconnect(id : string) : Promise<void> {
    return new Promise(async(resolve, reject) => {
      if (!this._amqp[id]) {
        throw new Error(`amqp '${id}' not found`);
      }
      if (this._amqp[id].connection) {
        try {
          await this._amqp[id].connection!.close();
          resolve();
        } catch (error) {
          throw error;
        }
      }
    });
  }

  async amqpCreateChannel(id : string, name: string) : Promise<void> {
    return new Promise(async(resolve, reject) => {
      if (!this._amqp[id]) {
        throw new Error(`amqp '${id}' not found`);
      }

      if (!this._amqp[id].connection) {
        throw new Error("No connection");
      }

      if (this._amqp[id].channels[name]) {
        return this._amqp[id].channels[name];
      }

      try {
        const channel = await this._amqp[id].connection!.createChannel();
        this._amqp[id].channels[name] = channel;
        resolve();
      } catch (error) {
        throw error;
      }
    });
  }

  async amqpDeleteChannel(id : string, name: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].connection) {
        throw new Error("No connection");
      }

      if (!this._amqp[id].channels[name]) {
        return;
      }

      try {
        await this._amqp[id].channels[name].close();
        delete this._amqp[id].channels[name];
        resolve();
      } catch (error) {
        throw error;
      }
    });
  }

  async amqpCreateExchange(id : string, channel: string, name: string, type: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].connection) {
        throw new Error("No connection");
      }

      if (!this._amqp[id].channels[channel]) {
        throw new Error("No channel");
      }

      if (!Server.amqpTypes.includes(type)) {
        throw new Error("Invalid type");
      }

      try {
        await this._amqp[id].channels[channel].assertExchange(name, type, { durable: false });
        resolve();
      } catch (error) {
        throw error;
      }
    });
  }

  async amqpDeleteExchange(id : string, name: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].connection) {
        throw new Error("No connection");
      }

      if (!this._amqp[id].channels[name]) {
        throw new Error("No channel");
      }

      try {
        await this._amqp[id].channels[name].deleteExchange(name);
        resolve();
      } catch (error) {
        throw error;
      }
    });
  }

  async amqpCreateQueue(id : string, channel: string, name: string, exchange: string, pattern?: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].channels[channel]) {
        throw new Error("No channel");
      }
      try {
        await this._amqp[id].channels[channel].assertQueue(name, { durable: false });
      } catch (error) {
        throw error;
      }
      try {
        if (pattern != null) {
          await this._amqp[id].channels[channel].bindQueue(name, exchange, pattern);
        } else {
          await this._amqp[id].channels[channel].bindQueue(name, exchange, "");
        }
        resolve();
      } catch (error) {
        throw error;
      }
    });
  }

  async amqpDeleteQueue(id : string, channel: string, name: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].channels[channel]) {
        throw new Error("No channel");
      }
      try {
        await this._amqp[id].channels[channel].deleteQueue(name);
        resolve();
      } catch (error) {
        throw error;
      }
    });
  }

  async amqpSend(id : string, channel: string, exchange : string, routingKey: string, message: string) : Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this._amqp[id].channels[channel]) {
        throw new Error("No channel");
      }
      try {
        this._amqp[id].channels[channel].publish(exchange, routingKey, Buffer.from(message));
        resolve();
      } catch (error) {
        throw error;
      }
    });
  }

  async amqpReceive(id : string, channel: string, queue: string, onMessage : any, maxNumber? : number) : Promise<string> {
    return new Promise(async (resolve) => {
      if (!this._amqp[id].channels[channel]) {
        throw new Error("No channel");
      }
      try {
        if (maxNumber) {
          await this._amqp[id].channels[channel].prefetch(maxNumber);
        }
        await this._amqp[id].channels[channel].consume(queue, onMessage, { noAck: false });
      } catch (error) {
        throw error;
      }
    });
  }

  async amqpGetChannel(id : string, channel: string) : Promise<any> {
    return new Promise(async (resolve) => {
      if (!this._amqp[id].channels[channel]) {
        throw new Error("No channel");
      }
      resolve(this._amqp[id].channels[channel]);
    });
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
    }), code: jobOpt.name, isScheduled: false, options: { execOnStart: jobOpt.executeOnStart }
    });
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
