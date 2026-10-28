import { spawnSync } from 'node:child_process';
import { openSync, readSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function askPassword() {
  const fd = openSync('/dev/tty', 'r');
  const bytes = [];
  const buffer = Buffer.alloc(1);
  let echoDisabled = false;

  process.stdout.write('Mot de passe administrateur : ');

  try {
    execFileSync('stty', ['-echo'], {
      stdio: [fd, 'ignore', 'ignore'],
    });
    echoDisabled = true;

    execFileSync('stty', ['-F', '/dev/tty', '-echo'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    while (true) {
      const count = readSync(fd, buffer, 0, 1, null);

      if (count === 0) {
        throw new Error('Terminal fermé');
      }

      if (buffer[0] === 10 || buffer[0] === 13) {
        break;
      }

      if (buffer[0] === 3) {
        throw new Error('Saisie annulée');
      }

      bytes.push(buffer[0]);
    }

    return Buffer.from(bytes).toString('utf8');
  } finally {
    if (echoDisabled) {
      execFileSync('stty', ['echo'], {
        stdio: [fd, 'ignore', 'ignore'],
      });
    }

    closeSync(fd);
    process.stdout.write('\n');
  }
}

const password = askPassword();

const result = spawnSync(
  'npx',
  [
    '--no-install',
    'vitest',
    'run',
    '--config',
    'vitest.config.integration.ts',
  ],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      ATSI_TEST_ADMIN_USERNAME: 'atsi_admin',
      ATSI_TEST_ADMIN_PASSWORD: password,
      ATSI_ALLOWED_ORIGIN: 'http://localhost:3000',
    },
  },
);

process.exitCode = result.status ?? 1;
