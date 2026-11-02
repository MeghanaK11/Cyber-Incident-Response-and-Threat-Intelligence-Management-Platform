
import {
  createRawAlert,
  getRecentAlerts,
  getAlertSeveritySummary,
  getAlertSourceSummary,
} from "../src/server/mongo/alerts";

import {
  createThreatFeed,
  getRecentThreatFeeds,
} from "../src/server/mongo/threatFeeds";

import { closeMongoConnection } from "../src/server/mongo";
import { getMongoDb } from "../src/server/mongo";

async function testMongoDB() {
  try {
    console.log("Testing MongoDB operations...");

    const db = await getMongoDb();

    // Check whether the test alert already exists.
    const existingAlert = await db.collection("raw_alerts").findOne({
      source: "Test Firewall",
      alertType: "INTRUSION_ATTEMPT",
      message: "Test suspicious login attempt",
    });

    if (existingAlert) {
      console.log("Test alert already exists. Skipping insertion.");
    } else {
      const alertId = await createRawAlert({
        source: "Test Firewall",
        alertType: "INTRUSION_ATTEMPT",
        severity: "HIGH",
        message: "Test suspicious login attempt",
        payload: { ip: "192.0.2.10" },
      });

      console.log("Alert inserted:", alertId);
    }

    // Check whether the test threat feed already exists.
    const existingFeed = await db.collection("threat_feeds").findOne({
      source: "Test Threat Feed",
      indicatorType: "IP",
      indicatorValue: "192.0.2.10",
      category: "Malicious IP",
    });

    if (existingFeed) {
      console.log("Test threat feed already exists. Skipping insertion.");
    } else {
      const feedId = await createThreatFeed({
        source: "Test Threat Feed",
        indicatorType: "IP",
        indicatorValue: "192.0.2.10",
        category: "Malicious IP",
        confidence: 90,
        rawData: { test: true },
      });

      console.log("Threat feed inserted:", feedId);
    }

    console.log("Recent alerts:", await getRecentAlerts());
    console.log("Recent threat feeds:", await getRecentThreatFeeds());

    console.log("\nTesting alert severity aggregation...");
    const severitySummary = await getAlertSeveritySummary();
    console.table(severitySummary);

    console.log("\nTesting alert source aggregation...");
    const sourceSummary = await getAlertSourceSummary();
    console.table(sourceSummary);

    console.log("\nMongoDB tests completed successfully.");
  } catch (error) {
    console.error("MongoDB test failed:", error);
    process.exitCode = 1;
  } finally {
    await closeMongoConnection();
  }
}

testMongoDB();
