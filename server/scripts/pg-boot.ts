/** Boots a throwaway Postgres (embedded binaries, `postgres` system user). */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const PG_PORT = 54413;
const NATIVE_CANDIDATES = [
  path.resolve(process.cwd(), 'node_modules/@embedded-postgres/linux-x64/native'),
  path.resolve(process.cwd(), '../node_modules/@embedded-postgres/linux-x64/native'),
  path.resolve(path.dirname(new URL(import.meta.url).pathname), '../node_modules/@embedded-postgres/linux-x64/native'),
  path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../node_modules/@embedded-postgres/linux-x64/native'),
];
const NATIVE_SRC = NATIVE_CANDIDATES.find((c) => fs.existsSync(c)) ?? NATIVE_CANDIDATES[0];
const NATIVE = '/tmp/pgnative';
const DATA = '/tmp/jptest-pgdata';
const SOCK = '/tmp/jptest-sock';

function sh(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: 'pipe' });
}
function asPostgres(bin: string, args: string[]): void {
  execFileSync('runuser', ['-u', 'postgres', '--', path.join(NATIVE, 'bin', bin), ...args], { stdio: 'pipe' });
}

export async function startTestPg(): Promise<{ url: string; stop: () => void }> {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.rmSync(SOCK, { recursive: true, force: true });
  fs.rmSync(NATIVE, { recursive: true, force: true });
  sh('cp', ['-r', NATIVE_SRC, NATIVE]);
  sh('chmod', ['-R', 'a+rX', NATIVE]);
  fs.mkdirSync(SOCK, { recursive: true });
  sh('chown', ['postgres:postgres', SOCK]);
  sh('mkdir', ['-p', DATA]);
  sh('chown', ['postgres:postgres', DATA]);
  asPostgres('initdb', ['-D', DATA, '--auth=trust', '--username=postgres', '-E', 'UTF8', '--locale=C.UTF-8']);
  asPostgres('pg_ctl', ['-D', DATA, '-o', `-p ${PG_PORT} -k ${SOCK} -c listen_addresses=127.0.0.1`, '-l', '/tmp/jptest-pg.log', 'start']);
  const url = `postgres://postgres@127.0.0.1:${PG_PORT}/postgres`;
  return {
    url,
    stop: () => {
      try { asPostgres('pg_ctl', ['-D', DATA, '-m', 'fast', 'stop']); } catch { /* already stopped */ }
      fs.rmSync(DATA, { recursive: true, force: true });
      fs.rmSync(SOCK, { recursive: true, force: true });
    },
  };
}
