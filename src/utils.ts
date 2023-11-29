import { DateTime } from "luxon";

export class Utils {
  public static DateToDateTime<T extends any | Array<any>>(obj: T): T {
    if (Array.isArray(obj)) return (obj as any[]).map((elem) => Utils.DateToDateTime(elem)) as T;
    const localObj = obj as any;
    Object.keys(localObj).forEach((key: any) => {
      if (localObj[key] instanceof Date) localObj[key] = DateTime.fromJSDate(localObj[key]);
      else if (typeof localObj[key] === 'object') Utils.DateToDateTime(obj);
      else if (Array.isArray(localObj[key])) localObj[key].foreach((elem: any) => {
        if (typeof elem === 'object') Utils.DateToDateTime(elem);
      })
    });
    return localObj as T;
  }
}