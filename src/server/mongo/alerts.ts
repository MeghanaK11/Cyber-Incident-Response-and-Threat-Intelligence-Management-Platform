
import { Collection, ObjectId } from "mongodb";
import { getMongoDb } from "../mongo";

export interface RawAlert {
  _id?: ObjectId;
  source: string;
  alertType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  expiresAt?: Date;
}

export type NewRawAlert = Omit<RawAlert, "_id" | "receivedAt"> & {
  receivedAt?: Date;
};

async function getAlertsCollection(): Promise<Collection<RawAlert>> {
  const db = await getMongoDb();
  return db.collection<RawAlert>("raw_alerts");
}

export async function ensureAlertIndexes(): Promise<void> {
  const collection = await getAlertsCollection();

  await collection.createIndex({ receivedAt: -1 });
  await collection.createIndex({ severity: 1 });
  await collection.createIndex({ source: 1 });

  // Documents expire at expiresAt when that field is provided.
  await collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
  );
}

export async function createRawAlert(
  alert: NewRawAlert
): Promise<string> {
  const collection = await getAlertsCollection();

  const result = await collection.insertOne({
    ...alert,
    receivedAt: alert.receivedAt ?? new Date(),
  });

  return result.insertedId.toString();
}

export async function getRecentAlerts(
  limit = 50
): Promise<RawAlert[]> {
  const collection = await getAlertsCollection();

  return collection
    .find()
    .sort({ receivedAt: -1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .toArray();
}

export async function getAlertById(
  id: string
): Promise<RawAlert | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = await getAlertsCollection();

  return collection.findOne({ _id: new ObjectId(id) });
}
