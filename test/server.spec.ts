import { Server } from '../src/server';
import chai from 'chai';
import chaiHttp from 'chai-http';
import { Api } from '../src/api';
import { IApiOptions } from "../src/interfaces";
import { Router } from 'express';
import { ControllerBase } from '../src/controller-base';
chai.use(chaiHttp);

export class TestApi extends Api {
  public static inst: TestApi;
  public setStaticInst(): void { TestApi.inst = this; }

  public init(_options: IApiOptions): Router {

    this.router.use('/api', TestController.create());

    return this.router;
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
        instance: new TestApi(),
      }]
    })
    server.start().then(() =>
    // error http://localhost/test/api don't respond
      chai.request(server.app).get('/test/api')
        .then((res) => {
          chai.expect(res.text).to.eql('Hello All41!');
          server.stop();
          done();
        })
    );
  }).timeout(0);
});
