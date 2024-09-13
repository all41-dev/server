import { Request, Response, NextFunction, RequestHandler, Router} from 'express';
import { ParsedQs } from "qs";

export interface IRouteDefinition {
  verb: 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';
  path: string;
  handlers: RequestHandler<any, any, any, ParsedQs, Record<string, any>> | Array<RequestHandler<any, any, any, ParsedQs, Record<string, any>>>
}
export interface IControllerInstanceType<T> extends Request {
  _this: T;
}

export abstract class ControllerBase {
  private static _certsCache: any = {};

  public routes: IRouteDefinition[];
  protected title: string;
  private scripts: string[];

  public constructor() {
    this.title = '';
    this.scripts = [];
    this.routes = [];
  }

  public defineRoutes(...routes: IRouteDefinition[]): void {
    routes.forEach((r) => this.defineRoute(r));
  }

  public registerRoutes(router: Router, ...routes: Array<IRouteDefinition>) {
    routes.forEach((route) => router[route.verb](route.path, this.injectThis(route.handlers)));
  }
  // public registerRouteBySignature(router: Router, verb: 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head', path: string) {
  //   const foundRoute = this.routes.find((r) => r.verb === verb && r.path === path);
  //   if (!foundRoute) throw new Error(`route ${verb}:${path} not found`);
  //   router[verb](path, foundRoute.handlers);
  // }
  public defineRouteBeforeSignature(afterRoute: { verb: 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head', path: string }, routeDef: IRouteDefinition): void {
    const foundRouteIdx = this.routes.findIndex((r) => r.verb === afterRoute.verb && r.path === afterRoute.path);
    if (foundRouteIdx === -1) throw new Error(`route ${afterRoute.verb}:${afterRoute.path} not found`);
    this.routes.splice(foundRouteIdx, 0, routeDef);
  }

  public addScript(src: string): ControllerBase {
    this.scripts.push(src);
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public render(res: Response, view: string, options?: any): void {
    res.locals.BASE_URL = '/';
    res.locals.scripts = this.scripts;
    res.locals.title = this.title;

    res.render(view, options);
  }

  protected createBase(router?: Router) {
    const usedRouter = router || Router();
    this.registerRoutes(usedRouter, ...this.routes);

    return usedRouter;
  }
  private injectThis(handlers: RequestHandler<any, any, any, ParsedQs, Record<string, any>> | Array<RequestHandler<any, any, any, ParsedQs, Record<string, any>>>)
    : RequestHandler<any, any, any, ParsedQs, Record<string, any>> | Array<RequestHandler<any, any, any, ParsedQs, Record<string, any>>> {
    const localHandlers = Array.isArray(handlers) ? handlers : [handlers];
    const result = localHandlers.map((ctHhandler) => {
      const thisHandler = (req: Request, res: Response, next: NextFunction) => {
        // adding this context
        (req as any)._this = this;
        ctHhandler(req, res, next);
      };
      return thisHandler;
    });
    return result;
  }
  private defineRoute(route: IRouteDefinition) {
    const existingRoute = this.routes.find((r) => r.verb === route.verb && r.path === route.path);

    if (existingRoute) {
      existingRoute.handlers = route.handlers;
    } else {
      this.routes.push(route);
    }
  }
}
