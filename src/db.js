import Datastore from "nedb-promises";

const db = Datastore.create({
  filename: "./data/entries.db",
  autoload: true,
});

export default db;
