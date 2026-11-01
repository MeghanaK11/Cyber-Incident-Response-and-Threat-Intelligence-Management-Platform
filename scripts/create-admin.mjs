// Creates the first ADMIN account. Nothing is hard-coded: the name and email
// come from the command line and the password is typed in (or read from
// ADMIN_PASSWORD for scripted setups).
//
//   npm run create-admin -- "Kallepalli Sai Meghana" meghana@example.com

import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import pg from "pg";

const [fullName, email] = process.argv.slice(2);
if (!fullName || !email) {
  console.error('Usage: npm run create-admin -- "Full Name" email@example.com');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (check your .env)");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : "");
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = process.env.ADMIN_PASSWORD ?? (await askHidden("Password: "));
if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  console.error("Password must be 10+ characters with a letter, a digit and a symbol");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await client.query(
    `INSERT INTO users (full_name, email, password_hash, role_id)
     VALUES ($1, $2, $3, (SELECT role_id FROM roles WHERE role_name = 'ADMIN'))
     RETURNING user_id`,
    [fullName, email, hash],
  );
  console.log(`Admin created with user_id ${rows[0].user_id}. Sign in at http://localhost:3000/login`);
} catch (err) {
  console.error(`Could not create admin: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
