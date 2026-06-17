require("dotenv").config();
const mongoose = require("mongoose");

async function migrate() {
  try {
    // Local DB
    const localConn = await mongoose.createConnection(
      "mongodb://127.0.0.1:27017/staynest"
    ).asPromise();

    // Atlas DB
   const atlasUrl = process.env.MONGO_URL.replace("/?", "/locara?");

    const atlasConn = await mongoose.createConnection(
      atlasUrl
    ).asPromise();

    const collections = ["users", "listings", "bookings", "sessions"];

    console.log("Local DB:", localConn.name);
    console.log("Atlas DB:", atlasConn.name);

    for (const name of collections) {
      console.log(`Migrating ${name}...`);

      const data = await localConn.collection(name).find({}).toArray();

       if (data.length > 0) {
      await atlasConn.collection(name).deleteMany({});
      await atlasConn.collection(name).insertMany(data);
    }

      console.log(`${name}: ${data.length} documents migrated`);
    }

    console.log("Migration completed successfully!");

    await localConn.close();
    await atlasConn.close();

    process.exit(0);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();