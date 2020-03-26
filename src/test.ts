import { Server } from "./server";
import { isNumber } from "util";

const server = new Server({
  statics: {
    baseRoute: '/assets',
    ressourcePath: 'd:/temp',
    requireAuth: false,
  },
});

const port = process.env.HTTP_PORT && isNumber(process.env.HTTP_PORT) ?
  Number.parseInt(process.env.HTTP_PORT) :
  undefined;

server.start(process.env.SKIP_JOBS === 'true', port);