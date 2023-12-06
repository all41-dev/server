import { DateTime } from "luxon";
import { Response } from "express";
import { Server } from "./server";

export class Utils {
  private static _inst: Utils;
  public static get inst(): Utils { return Utils._inst || (Utils._inst = new Utils()); }

  public dateToDateTime<T extends any | Array<any>>(obj: T): T {
    const localObj = obj as any;
    Object.keys(localObj).forEach((key: any) => {
      if (localObj[key] instanceof Date) localObj[key] = DateTime.fromJSDate(localObj[key]);
      else if (typeof localObj[key] === 'object') Utils.inst.dateToDateTime(localObj[key]);
      else if (Array.isArray(localObj[key])) localObj[key].foreach((elem: any) => {
        if (typeof elem === 'object') Utils.inst.dateToDateTime(elem);
        else if (elem instanceof Date) elem = DateTime.fromJSDate(elem);
      })
    });
    return localObj as T;
  }
  public handleCatch(error: Error, res: Response) {
    Server.logger.error(error.message, error);
    res.status(500).send(error)
  }
}