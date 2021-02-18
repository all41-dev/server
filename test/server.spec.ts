import { Server } from '../src/server';
import chai from 'chai';
import chaiHttp from 'chai-http';
import { Api } from '../src/api';
import { Router } from 'express';
import { ControllerBase } from '../src/controller-base';
import { Db } from '@all41-dev/db-tools';
import { Table, Model, PrimaryKey, AutoIncrement, Column, AllowNull, Unique, DataType } from 'sequelize-typescript';
chai.use(chaiHttp);

export class TestApi extends Api<TestApi> {
  public static inst: TestApi;
  public setStaticInst(): void { TestApi.inst = this; }

  public init(): Router {
    this.router.use('/api', TestController.create());

    return this.router;
  }
}

@Table({ modelName: 'person', tableName: 'person', timestamps: false })
export class DbPerson extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  public id!: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(30))
  public name!: string;
}

export class TestDb extends Db<TestDb> {
  public async init(): Promise<void> {
    await this._init();
    this.sequelize.addModels([DbPerson]);
  }
  
}

export class TestController extends ControllerBase {
  public static create(): Router {
    const router = Router();
    
    router.get('/', (req, res) => res.send('Hello All41!'));
    
    return router;
  }
}

describe('Server class', () => {
  it('Api', (done) => {
    process.env.HTTP_PORT = '1234';
    const server = new Server({
      apis: [{
        baseRoute: '/test',
        type: TestApi,
        requireAuth: false,
      }]
    })
    server.start().then(() =>
    // error http://localhost/test/api don't respond
      chai.request(server.app).get('/test/api')
        .then((res) => {
          chai.expect(res.text).to.eql('Hello All41!');
          server.stop().then(() => done());
        })
    );
  }).timeout(0);
  it('Db', (done) => {
    process.env.HTTP_PORT = '1234';
    const server = new Server({
      dbs: [{
        type: TestDb,
        dbName: 'all41',
        username: 'root',
        password: process.env.PASSWORD || 'PASSWORD not set',
        engine: 'mysql',
      }],
    })
    server.start().then(() =>
    // error http://localhost/test/api don't respond
      chai.request(server.app).get('/test/api')
        .then((res) => {
          DbPerson.findAll().then((res) => {
            chai.expect(res.length > 0).to.eql(true);
            server.stop().then(() => done());
          })
        })
    );
  }).timeout(0);
  it('stop', (done) => {
    process.env.HTTP_PORT = '1234';
    const server = new Server({
      apis: [{
        baseRoute: '/test',
        type: TestApi,
        requireAuth: false,
      }]
    })
    server.start().then(() =>
      // error http://localhost/test/api don't respond
      server.stop().then(() => {
        done("Process should have ended at this stage");
      }));
  }).timeout(0);
  it('multi restart', (done) => {
    process.env.HTTP_PORT = '1234';
    const server = new Server({
      apis: [{
        baseRoute: '/test',
        type: TestApi,
        requireAuth: false,
      }]
    });
    server.start().then(() =>
      // error http://localhost/test/api don't respond
      server.restart().then(() => {
        server.restart().then(() => {
          done();
        })
      }));
  }).timeout(0);
});
