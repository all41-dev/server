import { Db } from "@all41-dev/db-tools";
import { SampleTable } from "./sample-repository";

export class TestDb extends Db<TestDb> {
  public async init(): Promise<void> {
    await this._init();
    TestDb.inst = this;
    this.sequelize.addModels([SampleTable]);
  }
}