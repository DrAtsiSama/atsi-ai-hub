import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { stdin, stdout } from 'node:process';
import pg from 'pg';

const { Client } = pg;

if (!stdin.isTTY || !stdout.isTTY) {
  console.error('Un terminal interactif est nécessaire.');
  process.exit(1);
}

const { openSync, readSync, closeSync } = await import('node:fs');
const { execFileSync } = await import('node:child_process');

function readTerminal(question, hidden = false) {
  const fd = openSync('/dev/tty', 'r');
  const chunks = [];
  const buffer = Buffer.alloc(1);

  stdout.write(question);

  try {
    if (hidden) {
      execFileSync('stty', ['-echo'], {
        stdio: [fd, 'ignore', 'ignore'],
      });
    }

    while (true) {
      const count = readSync(fd, buffer, 0, 1, null);

      if (count === 0) {
        throw new Error('Terminal fermé');
      }

      const byte = buffer[0];

      if (byte === 10 || byte === 13) {
        break;
      }

      if (byte === 3) {
        throw new Error('Saisie annulée');
      }

      chunks.push(Buffer.from([byte]));
    }

    return Buffer.concat(chunks).toString('utf8');
  } finally {
    if (hidden) {
      execFileSync('stty', ['echo'], {
        stdio: [fd, 'ignore', 'ignore'],
      });
      stdout.write('\n');
    }

    closeSync(fd);
  }
}

async function ask(question) {
  return readTerminal(question);
}

async function askSecret(question) {
  return readTerminal(question, true);
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

  const existing = await client.query(
    'SELECT COUNT(*)::integer AS count FROM admin_users',
  );

  if (existing.rows[0].count > 0) {
    throw new Error(
      'Un administrateur existe déjà. Initialisation refusée.',
    );
  }

  const username = (await ask('Nom administrateur : ')).trim();

  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    throw new Error(
      'Identifiant invalide : 3 à 32 caractères, lettres, chiffres, _ ou -.',
    );
  }

  const password = await askSecret('Mot de passe : ');
  const confirmation = await askSecret('Confirmation : ');

  if (password.length < 12) {
    throw new Error('Le mot de passe doit contenir au moins 12 caractères.');
  }

  if (password !== confirmation) {
    throw new Error('Les mots de passe ne correspondent pas.');
  }

  const salt = randomBytes(32);
  const derivedKey = scryptSync(password, salt, 64);

  const passwordHash = [
    'scrypt',
    salt.toString('hex'),
    derivedKey.toString('hex'),
  ].join(':');

  await client.query('BEGIN');

  try {
    // Verrou transactionnel pour éviter deux initialisations simultanées.
    await client.query(
      'SELECT pg_advisory_xact_lock($1)',
      [20261028],
    );

    const check = await client.query(
      'SELECT COUNT(*)::integer AS count FROM admin_users',
    );

    if (check.rows[0].count > 0) {
      throw new Error('Un administrateur existe déjà.');
    }

    await client.query(
      `INSERT INTO admin_users (id, username, password_hash)
       VALUES ($1, $2, $3)`,
      [randomUUID(), username, passwordHash],
    );

    await client.query('COMMIT');

    console.log('Compte administrateur créé avec succès.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
} catch (error) {
  console.error('Initialisation :', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
