import { Server } from "./server";
import { SampleSequelizeRepository, SampleRepository2, SampleTable } from './test/sample-repository';
import { RepositorySequelize } from "./repository/repository-sequelize";
import { TestDb } from "./test/test-db";
import { SampleWorkflow } from "./test/sample-workflow";
import { Workflow } from "./workflow/workflow";

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
    sequelizeDerivedImplicitDbName: new SampleSequelizeRepository(),
    sequelizeDerivedExplicitDbName: new SampleSequelizeRepository({ dbName: 'spider_server_main_dev' }),
    sequelizeBase: new RepositorySequelize(SampleTable),
    plain: new SampleRepository2,
  },
  workflows: {
    sample: new SampleWorkflow,
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
  const wf = server.workflows.sample as Workflow<SampleTable>;
  const res = await wf.run('api', { exchangeCode: 'bar' });
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
