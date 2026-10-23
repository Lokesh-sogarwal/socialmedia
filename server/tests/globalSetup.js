import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo;

export async function setup({ provide }) {
  // Uses a locally installed mongod when MONGOMS_SYSTEM_BINARY is set, otherwise downloads one.
  mongo = await MongoMemoryServer.create();
  provide('mongoUri', mongo.getUri());
}

export async function teardown() {
  await mongo?.stop();
}
