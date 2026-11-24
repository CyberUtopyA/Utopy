import { readFileSync } from 'node:fs';
export function loadConfig(env = process.env) {
  const environment = env.SIFEN_ENV || 'test';
  // This P0 has no production implementation, regardless of user-provided flags.
  if (environment !== 'test' || env.SIFEN_PRODUCTION_ENABLED === 'true') throw new Error('PRODUCTION_BLOCKED');
  const privateConfig = env.SIFEN_CONFIG_PATH ? JSON.parse(readFileSync(env.SIFEN_CONFIG_PATH, 'utf8')) : { nodes: {}, subjects: {} };
  const transport=env.SIFEN_TRANSPORT||'dnit-test';
  if(!['mock','dnit-test'].includes(transport))throw new Error('TRANSPORT_INVALID');
  return { ...privateConfig, environment, enabled: env.SIFEN_TEST_ENABLED === 'true',
    dbPath: env.FISCAL_DB_PATH || './data/fiscal.sqlite', host: env.SIFEN_HOST || '127.0.0.1',
    port: Number(env.SIFEN_PORT || 4318), origins: (env.SIFEN_ALLOWED_ORIGINS || '').split(',').filter(Boolean),
    transport,adapterKeyPath: env.SIFEN_ADAPTER_KEY_PATH || null };
}
export function resolveSubject(config, issuerNodeId) {
  const node = Object.hasOwn(config.nodes, issuerNodeId) ? config.nodes[issuerNodeId] : null;
  const subject = node && Object.hasOwn(config.subjects, node.fiscalSubjectId) ? config.subjects[node.fiscalSubjectId] : null;
  if (!node || !subject) throw new Error('ISSUER_NOT_CONFIGURED');
  return { node, subject, fiscalSubjectId: node.fiscalSubjectId };
}
