import { Server } from "./server";
import { SampleRepository2, SampleSequelizeRepository, SampleTable } from './test/sample-repository';
import { TestDb } from "./test/test-db";
import { SampleWorkflow } from "./test/sample-workflow";
import { Workflow } from "@all41-dev/server.types";

const port = process.env.HTTP_PORT && typeof process.env.HTTP_PORT === 'number' ?
  Number.parseInt(process.env.HTTP_PORT) :
  undefined;

const server = new Server({
  statics: {
    baseRoute: '/assets',
    ressourcePath: 'd:/temp',
    requireAuth: false,
  },
  dbs: [{
    dbName: 'spider_server_main_dev',
    engine: 'mariadb',
    password: process.env.DB_PASSWORD || '',
    type: TestDb,
    username: 'root',

  }],
  repositories: {
    sequelizeBase: new SampleSequelizeRepository(SampleTable),
    plain: new SampleRepository2,
  },
  workflows: {
    sample: SampleWorkflow,
  },
  loggerOptions: {
    level: 'debug',
    // defaultMeta: ['test', 'all41ServerApp', `${os.hostname}Host`],
    defaultMeta: { foo: 'fooBar' },
  },
  skipJobScheduleAtStartup: process.env.SKIP_JOBS === 'true',
  httpPort: port,
  mute: true,
});
// eslint-disable-next-line no-console
console.info(`FOO=${process.env.FOO}`);

server.start().then(async () => {
  Server.logger.debug('server started');
  // const repo = server.repositories.sequelizeBase as RepositorySequelize<SampleTable>;
  // const res = await repo.getByKey('7fdac63b-bffc-440d-9ae2-813f123ba113');
  const wf = new server.workflows.sample({ source: 'api', actionContext: { record: { exchangeCode: 'bar' } } }) as Workflow<SampleTable>;
  const res = await wf.run();
  // console.log(res);

  // server.stop().then(() => {
  //   setTimeout(() => {
  //     server.start();
  //     Server.logger.debug('Server restart ended');
  //   }, 5000);

  // })
})
// Server.logger.error(new Error('Error from test'));
// Server.logger.info('test with meta', { ber: 'baz' });
