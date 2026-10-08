import { Bank } from './database.js';
import { TursoAdapter } from './turso-adapter.js';
import { assertCurrentSchema } from './migrations.js';

export async function connectRuntimeBank(env = process.env) {
  const adapter = TursoAdapter.fromEnvironment(env);
  try {
    await assertCurrentSchema(adapter);
    return new Bank(adapter);
  } catch (error) {
    await adapter.close();
    throw error;
  }
}

let bankPromise: Promise<Bank> | undefined;
export function runtimeBank() {
  bankPromise ??= connectRuntimeBank().catch((error) => {
    bankPromise = undefined;
    throw error;
  });
  return bankPromise;
}
