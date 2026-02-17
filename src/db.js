import Datastore from "nedb-promises";

export const entries = Datastore.create({
  filename: "./data/entries.db",
  autoload: true,
});

export const servers = Datastore.create({
  filename: "./data/servers.db",
  autoload: true,
});

