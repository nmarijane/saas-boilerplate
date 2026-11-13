import * as nextEnv from "@next/env";

// Reads the `.env*` files the way `next dev` and `next build` do, so that the
// scripts (the seed, and `drizzle.config.ts` for db:generate and db:migrate) are
// sent to the same database as the app, by the same variables: a `DATABASE_URL`
// in `.env.local` is used by all of them. The files are read in Next's order,
// the most specific first: `.env.<mode>.local`, `.env.local`, `.env.<mode>`,
// `.env`, with the mode `production` under `NODE_ENV=production` and
// `development` otherwise.
//
// A variable that is already set is never replaced, even when it is set to
// nothing (`DATABASE_URL=`): `screenshots:serve` sets it so, to keep a
// developer's files from sending its throwaway server to their database.
//
// A script imports this file before it reads the environment: the Drizzle config
// before the line that reads `DATABASE_URL`, the seed after its other imports (none
// of them reads the environment when it loads). `@next/env` is a CommonJS module, and the two
// loaders that run the scripts read it differently: the seed runs under tsx, an
// ES module that finds the function on the default export (Node cannot see its
// named exports); drizzle-kit loads its config as CommonJS and finds it by name.
const { loadEnvConfig } = (nextEnv as { default?: typeof nextEnv }).default ?? nextEnv;

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
