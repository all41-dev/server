import { Model, Table, PrimaryKey, DataType, Column, Default, Repository as SequelizeNativeRepository } from 'sequelize-typescript';
import { IRepositoryReadable, IRepositoryWritable, Repository } from '@all41-dev/server.types';
import { RepositorySequelize } from '@all41-dev/server.types';
import { DateTime } from "luxon";

export class SampleSequelizeRepository extends RepositorySequelize<SampleTable> implements Repository<SampleTable> {
  constructor(repository: SequelizeNativeRepository<SampleTable>) {
    super(SampleTable, repository);
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

@Table({ tableName: 'exchange', timestamps: false })
export class SampleTable extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare uuid: string;

  @Column(DataType.STRING(200))
  declare exchangeCode?: string;

  @Column(DataType.DATE)
  declare fooDate?: DateTime;

  public get pkName() { return 'uuid' as keyof SampleTable; }
}

export class SampleRepository2 implements Repository<SampleType>, IRepositoryReadable<SampleType> {
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