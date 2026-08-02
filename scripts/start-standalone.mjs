process.env.NODE_ENV = "production";

const server = new URL("../.next/standalone/server.js", import.meta.url).pathname;
import(server).catch((err) => {
  console.error(err);
  process.exit(1);
});
