import os from 'os';
import fetch from "@all41-dev/node-fetch";
import { Request, Response, NextFunction, RequestHandler, Router} from 'express';
import express from 'express';
import Jwt from 'jsonwebtoken';
import NodeRSA from 'node-rsa';
import { Server } from '../server';
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

  /*Returns Middleware for checking Access-Token*/
  public static checkAccess(scope: string[]): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      this.hasAccess(scope, req).then((hasAccess) => {
        if (hasAccess) {
          next();
        } else {
          res.status(403);
          res.send();    
        }
      }).catch(() => {
        res.status(403);
        res.send();    
      });
    };
  }
  public static async getTokenScope(req: Request): Promise<string | false> {
    if ((req as any).__tokenScope) return (req as any).__tokenScope;

    const token = await ControllerBase.getToken(req);
    if (!token) return false;

    (req as any).__tokenScope = token.scope;
    return token.scope;
  }
  public static async getTokenUser(req: Request): Promise<string | false> {
    const token = await ControllerBase.getToken(req);
    if (!token) return false;

    return token.username;
  }

  protected static async hasAccess(scope: string[], req: Request): Promise<boolean> {
    const tokenScope = await ControllerBase.getTokenScope(req);
    if (!tokenScope) return false;
    // concat flatten array of arrays to array
    const permissions: string[][] = ([] as string[][]).concat.apply([], tokenScope.split(' ')
      .map((p: string): string[] => {
        // functions for cartesian product, from -> https://stackoverflow.com/a/43053803/1073588
        const f = (a: any, b: any): never[] => [].concat(...a.map((d: any): any => b.map((e: any): any => [].concat(d, e))));
        const cartesian = (a: string[], b?: string[], ...c: string[][]): string[] => (b ? cartesian(f(a, b), ...c) : a);

        const permissionScopes = p.split('+')
          .map((scope1: string): any[] => {
            // process permission scope
            if (scope1.indexOf('|') === -1) {
              return [scope1];
            }
            // the scope path contains '|', then build one scope by combination
            const optionsArr = scope1.split('/')
              .map((slashPart): string[] => slashPart.split('|'));
            // if (optionsArr === undefined) { }
            const cart = cartesian(optionsArr[0], ...optionsArr.slice(1)).map((sc: any): any => sc.join('/'));
            return cart;
          });
        const cart2 = cartesian(permissionScopes[0], ...permissionScopes.slice(1));
        // console.info(cart2);
        // console.info('---');
        return cart2;
      }));

    return permissions.some((p): boolean => {
      if (p as any === '') { return false; }
      if (typeof p === 'string') p = [p];
      if (scope.length !== p.length) { return false; }
      let localScope: string[] = JSON.parse(JSON.stringify(scope));
      let matches = 0;

      for (; localScope.length > 0;) {
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < p.length; i++) {
          if (localScope[0].startsWith(p[i])) {
            matches++;
            // break;
          }
        }
        localScope = localScope.slice(1);
      }
      //console.info(p);
      //console.info(scope);
      //console.info(`matches: ${matches} scopes: ${scope.length}`);
      return matches === scope.length;
    });
  }

  protected static getNewRouter(): express.Router {
    return express.Router();
  }

  private static async getToken(req: Request): Promise<{ scope: string; username: string }|false> {
    if ((req as any).__token) return (req as any).__token;

    let token: {scope: string; username: string};

    if((req as any).openid) {
      token = (req as any).openid.tokens;
    } else {
      const authorizationHeader = req.headers.authorization;

      if (authorizationHeader === undefined || !authorizationHeader.toLowerCase().startsWith('bearer ')) {
        return false;
      }
      const jwtString = authorizationHeader.substr(7);
      const tokenWithHeader = Jwt.decode(jwtString, { complete: true }) as any;

      if (tokenWithHeader === null) { return false; }
      const kid = tokenWithHeader.header.kid;
      if (!tokenWithHeader.payload || !tokenWithHeader.payload.iss) {
        Server.logger.error(`${os.hostname}: can\'t get iss value at "payload.iss": ${tokenWithHeader}`);
      }
      const iss = tokenWithHeader.payload.iss;
      if (!ControllerBase._certsCache[iss]){
        ControllerBase._certsCache[iss] = await (await fetch(`${iss}/oauth2/certs`)).text();
      }

      const certs = JSON.parse(ControllerBase._certsCache[iss]);
      //const certs = JSON.parse(this.httpGet(`${iss}/oauth2/certs`));
      const keyDef = (certs.keys as [{ kid: string; n: string; e: string }]).find((k): boolean => k.kid === kid);
      if (keyDef === undefined) { return false; }

      const key = new NodeRSA({ b: 256 });
      key.importKey({
        e: Buffer.from(keyDef.e, 'base64'),
        n: Buffer.from(keyDef.n, 'base64'),
      }/*, 'pkcs1-public-pem'*/);
      const publicKey = key.exportKey('pkcs1-public-pem');

      token = Jwt.verify(jwtString, publicKey) as { scope: string; username: string };
    }

    if (token === null) {
      throw new Error('Expected the token to be an Object');
    }
    (req as any).__token = token;

    return token;
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
