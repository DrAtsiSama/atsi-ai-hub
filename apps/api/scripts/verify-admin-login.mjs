import pg from 'pg';
import { execFileSync } from 'node:child_process';
import { openSync, readSync, closeSync } from 'node:fs';
import { scryptSync, timingSafeEqual } from 'node:crypto';

const { Client } = pg;

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

    // Élimine les caractères déjà présents dans le tampon du terminal.
    execFileSync('stty', ['-F', '/dev/tty', 'echo'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });

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

const client = new Client({
  host: process.env.ATSI_DB_HOST ?? 'postgres',
  port: Number(process.env.ATSI_DB_PORT ?? 5432),
  database: process.env.ATSI_DB_NAME,
  user: process.env.ATSI_DB_USER,
  password: process.env.ATSI_DB_PASSWORD,
});

try {
  await client.connect();

  const result = await client.query(
    `SELECT password_hash
     FROM admin_users
     WHERE username = $1 AND is_active = TRUE`,
    ['atsi_admin'],
  );

  if (result.rows.length !== 1) {
    throw new Error('Administrateur actif introuvable');
  }

  const password = askPassword();
  const parts = result.rows[0].password_hash.split(':');

  if (
    parts.length !== 3 ||
    parts[0] !== 'scrypt' ||
    !/^[0-9a-f]{64}$/.test(parts[1]) ||
    !/^[0-9a-f]{128}$/.test(parts[2])
  ) {
    throw new Error('Format du hash invalide');
  }

  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(password, salt, expected.length);

  if (!timingSafeEqual(actual, expected)) {
    throw new Error('Mot de passe incorrect');
  }

  console.log('PASS : authentification administrateur validée');
} catch (error) {
  console.error('ÉCHEC :', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
