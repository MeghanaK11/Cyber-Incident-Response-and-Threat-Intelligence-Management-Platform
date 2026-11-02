import {
  createRawAlert,
  getRecentAlerts,
} from "../src/server/mongo/alerts";

import {
  createThreatFeed,
  getRecentThreatFeeds,
} from "../src/server/mongo/threatFeeds";

import { closeMongoConnection } from "../src/server/mongo";

async function testMongoDB() {
  try {
    console.log("Testing MongoDB operations...");

    const alertId = await createRawAlert({
      source: "Test Firewall",
      alertType: "INTRUSION_ATTEMPT",
      severity: "HIGH",
      message: "Test suspicious login attempt",
      payload: { ip: "192.0.2.10" },
    });

    console.log("Alert inserted:", alertId);

    const feedId = await createThreatFeed({
      source: "Test Threat Feed",
      indicatorType: "IP",
      indicatorValue: "192.0.2.10",
      category: "Malicious IP",
      confidence: 90,
      rawData: { test: true },
    });

    console.log("Threat feed inserted:", feedId);

    console.log("Recent alerts:", await getRecentAlerts());
    console.log("Recent threat feeds:", await getRecentThreatFeeds());
  } catch (error) {
    console.error("MongoDB test failed:", error);
    process.exitCode = 1;
  } finally {
    await closeMongoConnection();
  }
}

testMongoDB();