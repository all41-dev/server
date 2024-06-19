import { IPkName, IRepositoryWritable } from "./repository";

export interface IRepositoryMessaging<T extends IPkName<T> = any> extends IRepositoryWritable<T> {
  post(object: T, options?: any): Promise<void>;
  patch(key: any, object: Partial<T>, options?: any): Promise<void>;
  delete(key: any, options?: any): Promise<void>;
}