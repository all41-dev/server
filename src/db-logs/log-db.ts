import { LogEntry } from '../db-logs/log-entry';
import { Meta } from '../db-logs/meta';
import { Db } from '../db';

export class LogDb extends Db<LogDb> {
  public async init(): Promise<void> {
    // if (this.isInitialized) { return; }
    await this._init();
    LogDb.inst = this;
    this.sequelize.addModels([LogEntry, Meta]);
  }
}
