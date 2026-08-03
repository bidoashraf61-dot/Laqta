/**
 * Local development Postgres.
 *
 * No Docker or system Postgres is assumed. `embedded-postgres` downloads a
 * real Postgres binary into node_modules and runs it against ./.pgdata, so
 * every session can share one database with the same DATABASE_URL.
 *
 *   npm run db:start   boot on 5433 (idempotent)
 *   npm run db:stop    shut down
 *
 * In deployed environments point DATABASE_URL at the managed instance and
 * ignore this script entirely.
 */
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), '.pgdata')
const PORT = 5433
const USER = 'laqta'
const PASSWORD = 'laqta'
const DATABASE = 'laqta'

function makeServer() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  })
}

async function start() {
  const isFirstRun = !existsSync(DATA_DIR)
  if (isFirstRun) mkdirSync(DATA_DIR, { recursive: true })

  const pg = makeServer()
  if (isFirstRun) {
    console.log('Initialising Postgres cluster in .pgdata …')
    await pg.initialise()
  }

  await pg.start()

  // createDatabase throws if it already exists; that's a no-op for us.
  try {
    await pg.createDatabase(DATABASE)
    console.log(`Created database "${DATABASE}".`)
  } catch {
    /* already there */
  }

  console.log(`Postgres up on port ${PORT}.`)
  console.log(`DATABASE_URL="postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public"`)
}

async function stop() {
  const pg = makeServer()
  await pg.stop()
  console.log('Postgres stopped.')
}

const command = process.argv[2]
const run = command === 'stop' ? stop : start

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
