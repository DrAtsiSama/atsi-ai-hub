import { Redis } from 'ioredis';
import { randomUUID, createHash } from 'node:crypto';

const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'redis',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: 1,
});

const script = `
for i = 1, #KEYS do
  local count = tonumber(redis.call('GET', KEYS[i]) or '0')
  if count >= tonumber(ARGV[1]) then
    return 0
  end
end

for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then
    redis.call('EXPIRE', KEYS[i], ARGV[2])
  end
end

return 1
`;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function keys(ip, username) {
  const normalized = username.trim().toLowerCase();

  return [
    `atsi:auth:login:ip:${hash(`${ip}:${normalized}`)}`,
    `atsi:auth:login:user:${hash(normalized)}`,
  ];
}

async function reserve(ip, username) {
  return redis.eval(
    script,
    2,
    ...keys(ip, username),
    '5',
    '900',
  );
}

const username = `test-${randomUUID()}`;
const allKeys = [
  ...keys('192.0.2.1', username),
  ...keys('192.0.2.2', username),
];

try {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = await reserve('192.0.2.1', username);

    if (result !== 1) {
      throw new Error(`Tentative ${attempt} refusée prématurément`);
    }
  }

  console.log('PASS : 5 tentatives autorisées');

  if (await reserve('192.0.2.1', username) !== 0) {
    throw new Error('Sixième tentative non bloquée');
  }

  console.log('PASS : sixième tentative bloquée');

  if (await reserve('192.0.2.2', username) !== 0) {
    throw new Error('Contournement par changement IP');
  }

  console.log('PASS : changement IP bloqué');

  const ttl = await redis.ttl(keys('192.0.2.1', username)[1]);

  if (ttl <= 0 || ttl > 900) {
    throw new Error(`Expiration Redis incorrecte : ${ttl}`);
  }

  console.log(`PASS : expiration automatique (${ttl}s)`);

  const concurrentUsername = `test-${randomUUID()}`;
  const concurrentKeys = keys('192.0.2.3', concurrentUsername);

  allKeys.push(...concurrentKeys);

  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      reserve('192.0.2.3', concurrentUsername),
    ),
  );

  const accepted = results.filter((value) => value === 1).length;
  const rejected = results.filter((value) => value === 0).length;

  if (accepted !== 5 || rejected !== 15) {
    throw new Error(
      `Concurrence incorrecte : ${accepted} acceptées, ${rejected} refusées`,
    );
  }

  console.log(
    `PASS : concurrence (${accepted} acceptées, ${rejected} refusées)`,
  );

  console.log('VALIDATION REDIS : OK');
} finally {
  await redis.del(...allKeys);
  redis.disconnect();
}
