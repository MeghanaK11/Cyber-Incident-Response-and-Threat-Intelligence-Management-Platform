
import { ensureAlertIndexes } from "../src/server/mongo/alerts";
import { ensureThreatFeedIndexes } from "../src/server/mongo/threatFeeds";
import { closeMongoConnection } from "../src/server/mongo";

async function initializeMongoDB() {
  try {
    console.log("Initializing MongoDB...");

    await ensureAlertIndexes();
    console.log("Raw alerts collection indexes created.");

    await ensureThreatFeedIndexes();
    console.log("Threat feeds collection indexes created.");

    console.log("MongoDB initialization completed successfully.");
  } catch (error) {
    console.error("MongoDB initialization failed:", error);
    process.exitCode = 1;
  } finally {
    await closeMongoConnection();
  }
}

initializeMongoDB();
