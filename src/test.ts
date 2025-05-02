import { Server } from "./server";
import { SampleRepository2, SampleSequelizeRepository, SampleTable } from './db/sample-repository';
import { TestDb } from "./db/test-db";
import { SampleWorkflow } from "./db/sample-workflow";
import { Workflow } from "@all41-dev/server.types";
import path from "path";
import { DbDumper, IDbOptions } from "@all41-dev/db-tools";

const port = process.env.HTTP_PORT && typeof process.env.HTTP_PORT === 'number' ?
  Number.parseInt(process.env.HTTP_PORT) :
  undefined;

const dbOptions: IDbOptions<any> = {
  engine: 'mariadb',
  username: process.env.DB_USERNAME || 'root',
  hostname: process.env.DB_HOST,
  password: process.env.DB_PASSWORD || 'dev56DEV',
  dbName: process.env.DB_NAME || 'server_test',
  port: process.env.DB_PORT ? Number.parseInt(process.env.DB_PORT) : undefined,
  multipleStatements: true,
  type: TestDb,
  dbTools: {
    app: 'server',
    updateOnStartup: true,
    scriptsFolder: path.resolve(`${__dirname}/db/scripts`)
  },
};

const server = new Server({
  statics: {
    baseRoute: '/assets',
    ressourcePath: 'd:/temp',
    requireAuth: false,
  },
  dbs: dbOptions,
  repositories: {
    sequelizeBase: new SampleSequelizeRepository(),
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
console.info(`FOO=${process.env.DB_NAME}`);

server.start().then(async () => {
  Server.logger.debug('server started');
  // const repo = server.repositories.sequelizeBase as RepositorySequelize<SampleTable>;
  // const res = await repo.getByKey('7fdac63b-bffc-440d-9ae2-813f123ba113');
  new DbDumper(dbOptions)
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
