import { setupServer } from "msw/node";

/** Shared MSW server. Tests add handlers with server.use(...). Unhandled requests fail the test. */
export const server = setupServer();
