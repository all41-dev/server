import { Server } from "./server";
import { LogEntry } from "winston";

const server = new Server({
  statics: {
    baseRoute: '/assets',
    ressourcePath: 'd:/temp',
    requireAuth: false,
  },
  loggerOptions: {
    level: 'debug',
    // defaultMeta: ['test', 'all41ServerApp', `${os.hostname}Host`],
    defaultMeta: { foo: 'fooBar' },
  },
  skipJobScheduleAtStartup: true,
});
// eslint-disable-next-line no-console
console.info(`FOO=${process.env.FOO}`)
const port = process.env.HTTP_PORT && typeof process.env.HTTP_PORT === 'number' ?
  Number.parseInt(process.env.HTTP_PORT) :
  undefined;

server.start(process.env.SKIP_JOBS === 'true', port).then(() => {
  Server.logger.debug('server started');
  server.stop().then(() => {
    setTimeout(() => {
      server.start();
      Server.logger.debug('Server restart ended');
    }, 5000);
    
  })
})
// Server.logger.error(new Error('Error from test'));
// Server.logger.info('test with meta', { ber: 'baz' });
