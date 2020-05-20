import { Model, Table, PrimaryKey, DataType, Column, AllowNull, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { LogEntry } from './log-entry';

@Table({ tableName: 'meta', timestamps: false })
export class Meta extends Model<Meta> {
  @PrimaryKey
  @AllowNull(false)
  @ForeignKey((): typeof Model => LogEntry)
  @Column(DataType.UUID)
  public logEntryUuid!: string;

  @PrimaryKey
  @AllowNull(false)
  @Column(DataType.STRING(200))
  public key!: string;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  public value!: string;

  @BelongsTo((): typeof Model => LogEntry)
  public logEntry?: LogEntry;
}
