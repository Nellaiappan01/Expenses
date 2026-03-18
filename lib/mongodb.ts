import { MongoClient, Db } from "mongodb";

function getUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please add MONGODB_URI to your .env.local file");
  }
  return uri;
}
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let _clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  if (_clientPromise) return _clientPromise;
  if (process.env.NODE_ENV === "development" && global._mongoClientPromise) {
    _clientPromise = global._mongoClientPromise;
    return _clientPromise;
  }
  client = new MongoClient(getUri(), options);
  _clientPromise = client.connect();
  if (process.env.NODE_ENV === "development") {
    global._mongoClientPromise = _clientPromise;
  }
  return _clientPromise;
}

export async function getDb(): Promise<Db> {
  const c = await getClientPromise();
  return c.db();
}
