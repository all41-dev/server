import { Server } from "./server";
import { isNumber } from "util";
import { DbLogTransportInstance, LogDb } from "@all41-dev/log";
// import { LogDb } from "./db-logs/log-db";

const server = new Server({
  statics: {
    baseRoute: '/assets',
    ressourcePath: 'd:/temp',
    requireAuth: false,
  },
  loggerOptions: {
    level: 'info',
    // defaultMeta: ['test', 'all41ServerApp', `${os.hostname}Host`],
    defaultMeta: { foo: 'fooBar' },
    transports: new DbLogTransportInstance({
      db: {
        dbName: 'all41Log',
        engine: 'mariadb',
        username: 'root',
        password: process.env.PASSWORD || 'PASSWORD not set',
        hostname: 'localhost',
        type: LogDb,
      },
      level: 'info',
    })
  }
});

const port = process.env.HTTP_PORT && isNumber(process.env.HTTP_PORT) ?
  Number.parseInt(process.env.HTTP_PORT) :
  undefined;

server.start(process.env.SKIP_JOBS === 'true', port);
Server.logger.error(new Error('Error from test'));
Server.logger.info('test with meta', {ber: 'baz'});