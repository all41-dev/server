import { Server } from '../src/server';
import * as chai from 'chai';
// import chaiHttp from 'chai-http';
import { Api } from '../src/api';
import { Router } from 'express';
import { ControllerBase } from '../src/controller-base';
import { Db } from '@all41-dev/db-tools';
import { TestDb } from "../src/test/test-db";
import { Table, Model, PrimaryKey, AutoIncrement, Column, AllowNull, Unique, DataType } from 'sequelize-typescript';
import chaiHttp = require('chai-http');
import AMQP from "amqplib";
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
  public uuid!: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(30))
  public name!: string;
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
        .then((res: any) => {
          chai.expect(res.text).to.eql('Hello All41!');
          server.stop(true).then(() => {
            done();
          }).catch((err) => {
            done(err);
          });
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

describe("AMQPMethods", async () => {
  let server : Server;

  beforeEach(() => {
    server = new Server({
      amqp: {'local': {
        AMQP_URL: 'amqp://ops_server:ops_server_pass@localhost',
        connection: undefined,
        channels: {},
      }},
    });
    server.start();
  });

  after(() => {
    server.stop();
  });

  it("Connection",() => {
    server.amqpConnect('local');
  }).timeout(0);

  it("Disconnect",() => {
    server.amqpConnect('local');
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Connect to unknown id",() => {
    try {
      server.amqpConnect('unknown');
      chai.assert(false);
    } catch (e) {
      chai.assert(true);
    }
  }).timeout(0);

  it("Disconnect from unknown id", () => {
    try {
      server.amqpDisconnect('unknown');
      chai.assert(false);
    } catch (err) {
      chai.assert(true);
    }
  }).timeout(0);

  it("Create channel",() => {
    server.amqpConnect('local');
    try {
      server.amqpCreateChannel('local', 'test');
      chai.assert(true);
    } catch (err) {
      chai.assert(false);
    }
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Create channel with unknown id",() => {
    server.amqpConnect('local');
    try {
      server.amqpCreateChannel('unknown', 'test');
      chai.assert(false);
    } catch (err) {
      chai.assert(true);
    }
  }).timeout(0);

  it("Delete channel",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    try {
      server.amqpDeleteChannel('local', 'test');
      chai.assert(true);
    } catch (err) {
      chai.assert(false);
    }
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Delete channel with unknown id",() => {
    server.amqpConnect('local');
    try {
      server.amqpDeleteChannel('unknown', 'test');
      chai.assert(false);
    } catch (err) {
      chai.assert(true);
    }
  }).timeout(0);

  it("Delete channel with unknown name",() => {
    server.amqpConnect('local');
    try {
      server.amqpDeleteChannel('local', 'test');
      chai.assert(false);
    } catch (err) {
      chai.assert(true);
    }
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Create exchange",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    try {
      server.amqpCreateExchange('local', 'test', 'test', 'direct');
      chai.assert(true);
    } catch (err) {
      chai.assert(false);
    }
    server.amqpDeleteExchange('local', 'test');
    server.amqpDeleteChannel('local', 'test');
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Create exchange with unknown name",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    try {
      server.amqpCreateExchange('local', 'unknown', 'test', 'direct');
      chai.assert(false);
    } catch (err) {
      chai.assert(true);
    }
    server.amqpDeleteChannel('local', 'test');
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Create exchange with invalid type",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    try {
      server.amqpCreateExchange('local', 'test', 'test', 'direct');
      chai.assert(true);
    } catch (err) {
      chai.assert(false);
    }
    server.amqpDeleteChannel('local', 'test');
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Delete exchange",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    server.amqpCreateExchange('local', 'test', 'test', "direct");
    try {
      server.amqpDeleteExchange('local', 'test');
      chai.assert(true);
    } catch (err) {
      chai.assert(false);
    }
    server.amqpDeleteChannel('local', 'test');
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Delete exchange with unknown name",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    try {
      server.amqpDeleteExchange('local', 'test');
      chai.assert(false);
    } catch (err) {
      chai.assert(true);
    }
    server.amqpDeleteChannel('local', 'test');
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Create queue",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    server.amqpCreateExchange('local', 'test', 'test', "direct");
    try {
      server.amqpCreateQueue('local', 'test', 'test', 'test');
      chai.assert(true);
    } catch (err) {
      chai.assert(false);
    }
    server.amqpDeleteChannel('local', 'test');
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Delete queue",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    server.amqpCreateExchange('local', 'test', 'test', "direct");
    server.amqpCreateQueue('local', 'test', 'test', 'test');
    try {
      server.amqpDeleteQueue('local', 'test', 'test');
      chai.assert(true);
    } catch (err) {
      chai.assert(false);
    }
    server.amqpDeleteChannel('local', 'test');
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Send message",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    server.amqpCreateExchange('local', 'test', 'test', "fanout");
    server.amqpCreateQueue('local', 'test', 'test', 'test');
    try {
      server.amqpSend('local', 'test', 'test', 'test', 'test');
      chai.assert(true);
    } catch (err) {
      chai.assert(false);
    }
    server.amqpDeleteChannel('local', 'test');
    server.amqpDisconnect('local');
  }).timeout(0);

  it("Receive message",() => {
    server.amqpConnect('local');
    server.amqpCreateChannel('local', 'test');
    server.amqpCreateExchange('local', 'test', 'test', "direct");
    server.amqpCreateQueue('local', 'test', 'test', 'test', 'test');
    server.amqpSend('local', 'test', 'test', 'test', 'test');
    try {
      server.amqpReceive('local', 'test', 'test', (msg : AMQP.Message) => {
        if(msg) {
          chai.assert(true);
        } else {
          chai.assert(false);
        }
      });
    } catch (err) {
      chai.assert(false);
    }
    server.amqpDeleteChannel('local', 'test');
    server.amqpDisconnect('local');
  }).timeout(0);

});
