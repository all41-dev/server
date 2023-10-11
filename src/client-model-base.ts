export abstract class ClientModelBase<T extends ClientModelBase<any>> {
  private initialized = false;
  protected abstract pkPropName: keyof T;

  public init(options: { initialValues?: string | T/* as an interface */, pkValue?: any }) {
    if (this.initialized) throw new Error(`${this.constructor.name} object has already been initialized`);
    if (options.initialValues) {
      const initialValuesObj = typeof options.initialValues === 'string' ?
        JSON.parse(options.initialValues) as { [key: string]: any } :
        options.initialValues;
      Object.assign(this, initialValuesObj);
    }
    if (options.pkValue) {
      (this as unknown as T)[this.pkPropName] = options.pkValue;
    }
    this.initialized = true;
  }
}
