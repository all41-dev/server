import Cors, { CorsOptions } from 'cors';
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

  protected createRouter(corsOptions?: CorsOptions): express.Router {
    const baseCorsOptions: CorsOptions = {
      origin: '*',
      allowedHeaders: ['Authorization', 'Accept', 'Origin', 'DNT', 'X-CustomHeader', 'Keep-Alive', 'User-Agent', 'X-Requested-With', 'If-Modified-Since', 'Cache-Control', 'Content-Type', 'Content-Range', 'Range'],
      methods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true
    }

    const router = express.Router();
    router.use(express.json({ limit: '6mb' }));
    router.use(express.urlencoded({ extended: true }));
    router.use(Cors(corsOptions ? corsOptions : baseCorsOptions));
    return router;
  }

  public abstract init(): express.Router;

  public abstract setStaticInst(): void;
}
