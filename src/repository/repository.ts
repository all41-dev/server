export interface IPkName<T> { readonly pkName: keyof T }
export interface IRepositoryReadable<T extends IPkName<T>> {
  getByKey(key: any, options?: any): Promise<T>;
  get(options: any): Promise<T[]>;
}
export interface IRepositoryWritable<T extends IPkName<T>> {
  patch(key: any, object: Partial<T>, options?: any): Promise<T>;
  post(object: T, options?: any): Promise<T>;
  delete(key: any): Promise<void>;
}

/**
 * @template T model type served by the repository
 */
export interface Repository<T> {
  readonly modelType: new (plainObj?: Partial<T>) => T;
}
