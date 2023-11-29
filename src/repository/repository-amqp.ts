import { Repository, IRepositoryWritable, IPkName } from "./repository";

export class RepositoryAMQP<T extends IPkName<T>> implements Repository<T>, IRepositoryWritable<T> {
  modelType: new (plainObj?: Partial<T> | undefined) => T;
  
  constructor(modelType: new (plainObj?: Partial<T> | undefined) => T) {
    this.modelType = modelType;
  }
  patch(key: any, object: Partial<T>): Promise<T> {
    throw new Error("Method not implemented.");
  }
  post(object: T): Promise<T> {
    throw new Error("Method not implemented.");
  }
  delete(key: any): Promise<void> {
    throw new Error("Method not implemented.");
  }
}