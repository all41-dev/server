import { Model, Table, PrimaryKey, DataType, Column, AllowNull } from 'sequelize-typescript';
import { IRepositoryReadable, IRepositoryWritable, Repository } from '../repository/repository';
import { RepositorySequelize } from '../repository/repository-sequelize';
import { DateTime } from "luxon";

export class SampleSequelizeRepository extends RepositorySequelize<SampleTable> implements Repository<SampleTable> {
  constructor(options?: { dbName: string }) {
    super(SampleTable, options?.dbName);
  }
  public async init() {
    return this;
  }
}

export class SampleAMQPRepository implements Repository<SampleTable>, IRepositoryWritable<SampleType> {
  modelType: new (plainObj?: Partial<SampleTable> | undefined) => SampleTable;

  constructor() {
    this.modelType = SampleTable;
  }
  patch(key: any, object: Partial<SampleType>): Promise<SampleType> {
    throw new Error('Method not implemented.');
  }
  post(object: SampleType): Promise<SampleType> {
    throw new Error('Method not implemented.');
  }
  delete(key: any): Promise<void> {
    throw new Error('Method not implemented.');
  }

}

export class SampleTableCreation extends Model<SampleTable> {
  @Column(DataType.STRING(200))
  public exchangeCode?: string;

  @Column(DataType.DATE)
  public fooDate?: DateTime;
  constructor(values?: Partial<SampleTableCreation>) {
    super(values as any)
  }
}

@Table({ tableName: 'exchange' })
export class SampleTable extends SampleTableCreation {
  @PrimaryKey
  @AllowNull(false)
  @Column(DataType.UUIDV4)
  public uuid!: string;

  constructor(values?: Partial<SampleTable>) {
    super(values as any)
  }

  public get pkName() { return 'uuid' as keyof SampleTable; }
}

export class SampleRepository2 implements Repository<SampleType>, IRepositoryReadable<SampleType>  {
  public modelType: new () => SampleType;
  constructor() {
    this.modelType = SampleType;
  }
  async getByKey(key: any): Promise<SampleType> {
    throw new Error('Method not implemented.');
  }
  async get(options: any): Promise<SampleType[]> {
    throw new Error('Method not implemented.');
  }
  public async init() {
    return this;
  }
}

export class SampleType {
  public uuid?: string;
  public foo!: string;
  public get pkName() { return 'uuid' as keyof SampleType; }
}