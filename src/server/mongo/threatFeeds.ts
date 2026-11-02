
import { Collection, ObjectId } from "mongodb";
import { getMongoDb } from "../mongo";

export type IndicatorType = "IP" | "DOMAIN" | "URL" | "HASH";

export interface ThreatFeed {
  _id?: ObjectId;
  source: string;
  indicatorType: IndicatorType;
  indicatorValue: string;
  category: string;
  confidence: number;
  description?: string;
  rawData: Record<string, unknown>;
  receivedAt: Date;
  expiresAt?: Date;
}

export type NewThreatFeed = Omit<
  ThreatFeed,
  "_id" | "receivedAt"
> & {
  receivedAt?: Date;
};

async function getThreatFeedsCollection(): Promise<
  Collection<ThreatFeed>
> {
  const db = await getMongoDb();
  return db.collection<ThreatFeed>("threat_feeds");
}

export async function ensureThreatFeedIndexes(): Promise<void> {
  const collection = await getThreatFeedsCollection();

  await collection.createIndex({ receivedAt: -1 });
  await collection.createIndex({ indicatorValue: 1 });
  await collection.createIndex({ indicatorType: 1 });
  await collection.createIndex({ source: 1 });

  // Automatically removes documents when expiresAt is reached.
  await collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
  );
}

export async function createThreatFeed(
  feed: NewThreatFeed
): Promise<string> {
  if (feed.confidence < 0 || feed.confidence > 100) {
    throw new Error("Confidence must be between 0 and 100");
  }

  const collection = await getThreatFeedsCollection();

  const result = await collection.insertOne({
    ...feed,
    receivedAt: feed.receivedAt ?? new Date(),
  });

  return result.insertedId.toString();
}

export async function getRecentThreatFeeds(
  limit = 50
): Promise<ThreatFeed[]> {
  const collection = await getThreatFeedsCollection();

  return collection
    .find()
    .sort({ receivedAt: -1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .toArray();
}

export async function searchThreatFeeds(
  indicatorValue: string
): Promise<ThreatFeed[]> {
  const collection = await getThreatFeedsCollection();

  return collection
    .find({
      indicatorValue: {
        $regex: indicatorValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      },
    })
    .sort({ receivedAt: -1 })
    .limit(100)
    .toArray();
}
