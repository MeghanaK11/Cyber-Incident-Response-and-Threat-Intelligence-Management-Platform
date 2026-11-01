// Embeds every incident that has no vector yet or whose text changed.
//   npm run embed
import { getPool } from "../src/lib/db";
import { refreshEmbeddings } from "../src/server/embeddings";

refreshEmbeddings()
  .then(async (n) => {
    console.log(`${n} incident embedding(s) written`);
    await getPool().end();
  })
  .catch((err) => {
    console.error(`Embedding failed: ${err.message}`);
    process.exit(1);
  });
