import { DateTime } from "luxon";
import { Response } from "express";
import { Server } from "./server";

export class Utils {
  private static _inst: Utils;
  public static get inst(): Utils { return Utils._inst || (Utils._inst = new Utils()); }
  public dateToDateTime<T extends any | Array<any>>(obj: T): T {
    if (Array.isArray(obj)) return (obj as any[]).map((elem) => Utils.inst.dateToDateTime(elem)) as T;
    const localObj = obj as any;
    Object.keys(localObj).forEach((key: any) => {
      if (localObj[key] instanceof Date) localObj[key] = DateTime.fromJSDate(localObj[key]);
      else if (typeof localObj[key] === 'object') Utils.inst.dateToDateTime(obj);
      else if (Array.isArray(localObj[key])) localObj[key].foreach((elem: any) => {
        if (typeof elem === 'object') Utils.inst.dateToDateTime(elem);
      })
    });
    return localObj as T;
  }
  public handleCatch(error: Error, res: Response) {
    Server.logger.error(error.message, error);
    res.status(500).send(error)
  }
}