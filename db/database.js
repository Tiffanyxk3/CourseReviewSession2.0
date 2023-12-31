import { MongoClient } from "mongodb";

function MyMongoDB() {
  const myDB = {};
  const URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const DB_NAME = "SessionDB";
  const USERS_COLLECTION = "users";
  const SESSIONS_COLLECTION = "sessions";

  console.log("database is running...");
  const connect = async () => {
    const client = new MongoClient(URI);
    console.log("connect is running...");
    try {
      await client.connect();
      console.log("Successfully connected to DB: " + URI);

      const db = client.db(DB_NAME);
      const collections = await db.listCollections().toArray();
      console.log(
        "Collections:",
        collections.map(coll => coll.name),
      );

      return { client, db };
    } catch (err) {
      console.error("Failed to connect to the database:", err);
      // Explicitly return a rejected promise to ensure the caller handles it
      return Promise.reject(err);
    }
  };

  connect()
    .then(connection => {
      if (connection) {
        const { client, db } = connection;
        if (db) {
          console.log(`Database ${DB_NAME} is connected successfully.`);
          client.close();
        }
      }
    })
    .catch(err => {
      console.error("Error during database connection:", err);
    });

  async function initializeCounter() {
    const { client, db } = await connect();
    const existing = await db
      .collection("counters")
      .findOne({ _id: "SessionId" });
    if (!existing) {
      await db
        .collection("counters")
        .insertOne({ _id: "SessionId", sequence_value: 0 });
    }

    client.close();
  }

  initializeCounter("SessionId");

  async function getNextSequenceValue() {
    const { client, db } = await connect();
    const sequenceDocument = await db
      .collection("counters")
      .findOneAndUpdate(
        { _id: "SessionId" },
        { $inc: { sequence_value: 1 } },
        { returnOriginal: false },
      );
    client.close();
    if (
      !sequenceDocument ||
      (sequenceDocument && !("sequence_value" in sequenceDocument))
    ) {
      throw new Error("Failed to generate a sequence for SessionId");
    }

    return sequenceDocument.sequence_value;
  }

  myDB.findUser = async user => {
    const { client, db } = await connect();
    const collection = db.collection(USERS_COLLECTION);
    try {
      return await collection.findOne(user);
    } finally {
      client.close();
    }
  };

  myDB.addUser = async user => {
    const { client, db } = await connect();
    const collection = db.collection(USERS_COLLECTION);
    try {
      await collection.insertOne(user);
    } finally {
      client.close();
    }
  };

  myDB.editUser = async user => {
    const { client, db } = await connect();
    const collection = db.collection(USERS_COLLECTION);
    try {
      await collection.updateOne(
        { username: user.username },
        { $set: { major: user.major, tag: user.tag } },
      );

      return await myDB.getUser({ username: user.username });
    } finally {
      client.close();
    }
  };

  myDB.deleteUser = async user => {
    const { client, db } = await connect();
    const collection = db.collection(USERS_COLLECTION);
    try {
      await collection.deleteOne({ username: user.username });
    } finally {
      client.close();
    }
  };

  myDB.getUser = async username => {
    const { client, db } = await connect();
    const collection = db.collection(USERS_COLLECTION);
    try {
      return await collection.findOne(username);
    } finally {
      client.close();
    }
  };

  myDB.addJoined = async data => {
    const { client, db } = await connect();
    const collection = db.collection(USERS_COLLECTION);
    try {
      const username = {
        username: data.username,
      };
      const user = await myDB.getUser(username);
      const joined = user.joined;
      joined.push(data.course);
      await collection.updateOne(
        { username: data.username },
        { $set: { joined: joined } },
      );

      return await myDB.getUser({ username: data.username });
    } finally {
      client.close();
    }
  };

  myDB.deleteJoined = async data => {
    const { client, db } = await connect();
    const collection = db.collection(USERS_COLLECTION);
    try {
      const username = {
        username: data.username,
      };
      const user = await myDB.getUser(username);
      const joined = user.joined;
      const index = joined.indexOf(data.course);
      joined.splice(index, 1);
      await collection.updateOne(
        { username: data.username },
        { $set: { joined: joined } },
      );

      return await myDB.getUser({ username: data.username });
    } finally {
      client.close();
    }
  };

  myDB.getJoined = async data => {
    const { client, db } = await connect();
    const collection = db.collection(USERS_COLLECTION);
    try {
      const username = {
        username: data.username,
      };
      const user = await myDB.getUser(username);
      return user.joined;
    } finally {
      client.close();
    }
  };

  myDB.insertSessionEntry = async function (sessionEntry) {
    const { client, db } = await connect();
    const collection = db.collection(SESSIONS_COLLECTION);
    const newSessionEntry = {
      SessionID: await getNextSequenceValue(),
      ...sessionEntry,
    };
    try {
      return await collection.insertOne(newSessionEntry);
    } finally {
      client.close();
    }
  };

  myDB.getSessions = async function () {
    const { client, db } = await connect();
    const collection = db.collection(SESSIONS_COLLECTION);
    try {
      return await collection.find({}).toArray();
    } finally {
      client.close();
    }
  };

  myDB.getSessionByUsername = async function (username) {
    const { client, db } = await connect();
    const collection = db.collection(SESSIONS_COLLECTION);
    try {
      const sessions = await collection.find({ creator: username }).toArray();
      return sessions;
    } finally {
      client.close();
    }
  };

  myDB.getSessionsByMemberUsername = async function (username) {
    const { client, db } = await connect();
    const collection = db.collection(SESSIONS_COLLECTION);
    try {
      const sessions = await collection
        .find({
          members: { $in: [username] },
          creator: { $ne: username },
        })
        .toArray();
      return sessions;
    } finally {
      client.close();
    }
  };

  myDB.getSessionsByCourseNumber = async function (courseNumber) {
    const { client, db } = await connect();
    const collection = db.collection(SESSIONS_COLLECTION);
    try {
      const sessions = await collection
        .find({ courseNumber: courseNumber })
        .toArray();
      return sessions;
    } finally {
      client.close();
    }
  };

  myDB.updateSession = async function (id, sessionEntry) {
    const { client, db } = await connect();
    const collection = db.collection(SESSIONS_COLLECTION);
    try {
      return await collection.findOneAndUpdate(
        { SessionID: parseInt(id, 10) },
        { $set: sessionEntry },
        { returnOriginal: false },
      );
    } finally {
      client.close();
    }
  };

  myDB.deleteSession = async function (id) {
    const { client, db } = await connect();
    const collection = db.collection(SESSIONS_COLLECTION);
    try {
      return await collection.deleteOne({ SessionID: parseInt(id, 10) });
    } finally {
      client.close();
    }
  };
  myDB.userJoinSession = async function (sessionID, username) {
    const { client, db } = await connect();
    const collection = db.collection(SESSIONS_COLLECTION);
    try {
      return await collection.findOneAndUpdate(
        { SessionID: parseInt(sessionID, 10) },
        { $addToSet: { members: username } },
        { returnOriginal: false },
      );
    } finally {
      client.close();
    }
  };
  myDB.userLeaveSession = async function (sessionID, username) {
    const { client, db } = await connect();
    const collection = db.collection(SESSIONS_COLLECTION);
    try {
      return await collection.findOneAndUpdate(
        { SessionID: parseInt(sessionID, 10) },
        { $pull: { members: username } },
        { returnOriginal: false },
      );
    } finally {
      client.close();
    }
  };
  return myDB;
}

export const myDB = MyMongoDB();
