import { Db } from "@all41-dev/db-tools";
import { SampleTable } from "./sample-repository";

export class TestDb extends Db<TestDb> {
  public async init(): Promise<void> {
    this._init();
    this.sequelize.addModels([SampleTable]);
  }
}