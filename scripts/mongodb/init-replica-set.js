const replicaSetName = 'rs0';
const memberHost = 'mongodb:27017';

try {
  const status = rs.status();

  if (status.ok === 1) {
    print(`Replica set ${replicaSetName} is already initialized.`);
  }
} catch (error) {
  if (error.code !== 94 && error.codeName !== 'NotYetInitialized') {
    throw error;
  }

  const result = rs.initiate({
    _id: replicaSetName,
    members: [{ _id: 0, host: memberHost }],
  });

  if (result.ok !== 1) {
    throw new Error(`Replica set initialization failed: ${tojson(result)}`);
  }

  print(`Replica set ${replicaSetName} initialization requested.`);
}

for (let attempt = 1; attempt <= 30; attempt += 1) {
  if (db.adminCommand({ hello: 1 }).isWritablePrimary) {
    print(`Replica set ${replicaSetName} is ready and writable.`);
    quit(0);
  }

  sleep(1000);
}

throw new Error(
  `Replica set ${replicaSetName} did not elect a primary within 30 seconds.`,
);
