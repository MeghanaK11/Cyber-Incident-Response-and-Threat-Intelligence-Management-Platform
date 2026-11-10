import bcrypt from "bcryptjs";
import pg from "pg";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run reset-password -- email "NewPassword"');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const hash = await bcrypt.hash(password, 12);
  const { rowCount } = await client.query(
    `UPDATE users SET password_hash = $1, is_active = true WHERE email = $2`,
    [hash, email],
  );
  console.log(rowCount ? `Password updated for ${email}` : `No user with email ${email}`);
} finally {
  await client.end();
}