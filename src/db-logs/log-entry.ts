import { Model, Table, PrimaryKey, Default, DataType, Column, AllowNull, BelongsTo, ForeignKey, HasMany } from 'sequelize-typescript';
import { Meta } from './meta';

@Table({ tableName: 'logEntry' })
export class LogEntry extends Model<LogEntry> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  public id!: string;

  @AllowNull(false)
  @Column(DataType.STRING(50))
  public levelCode!: string;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  public message!: string;

  @AllowNull
  @Column(DataType.TEXT)
  public callStack?: string;
  @HasMany((): typeof Model => Meta)
  public metas?: Meta[];
}
