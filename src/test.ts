import { Server } from "./server";
import { SampleRepository2, SampleSequelizeRepository, SampleTable } from './test/sample-repository';
import { TestDb } from "./test/test-db";
import { SampleWorkflow } from "./test/sample-workflow";
import { Workflow } from "@all41-dev/server.types";
import path from "path";
import { IDbOptions } from "@all41-dev/db-tools";

const port = process.env.HTTP_PORT && typeof process.env.HTTP_PORT === 'number' ?
  Number.parseInt(process.env.HTTP_PORT) :
  undefined;

const dbOptions: IDbOptions<any> = {
  dbName: process.env.DB_NAME || 'test',
  hostname: process.env.DB_HOST,
  engine: 'mariadb',
  password: process.env.DB_PASSWORD || '',
  type: TestDb,
  username: 'root',
  dbTools: {
    app: 'testServer',
    updateOnStartup: true,
    scriptsFolder: path.resolve(`${__dirname}/test/scripts`)
  },
  port: process.env.DB_PORT ? Number.parseInt(process.env.DB_PORT) : undefined,
  multipleStatements: true,
  dumper: {
    cron: process.env.DBDUMPER_CRON,
    dumpPath: process.env.DUMP_PATH,
    ftpHost: process.env.DBDUMPER_FTP_HOST,
    ftpPassword: process.env.DBDUMPER_FTP_PASSWORD,
    ftpUser: process.env.DBDUMPER_FTP_USER,
    ftpPath: process.env.DBDUMPER_FTP_PATH,
    ftpPort: process.env.DBDUMPER_FTP_PORT ? parseInt(process.env.DBDUMPER_FTP_PORT) : 21,
    numberFilesToKeep: process.env.DBDUMPER_KEEP_NUMBER ? parseInt(process.env.DBDUMPER_KEEP_NUMBER) : 7,
    numberMonthlyFilesToKeep: process.env.DBDUMPER_MONTHLY_KEEP_NUMBER ? parseInt(process.env.DBDUMPER_MONTHLY_KEEP_NUMBER) : 0, // 0 = no limit
  }
};
const server = new Server({
  statics: {
    baseRoute: '/assets',
    ressourcePath: 'd:/temp',
    requireAuth: false,
  },
  dbs: [dbOptions],
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
