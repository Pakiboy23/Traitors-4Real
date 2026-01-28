/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_879072730");

  const uniqueIndex = "CREATE UNIQUE INDEX `idx_games_slug` ON `games` (`slug`)";
  if (!collection.indexes.includes(uniqueIndex)) {
    collection.indexes.push(uniqueIndex);
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_879072730");

  const uniqueIndex = "CREATE UNIQUE INDEX `idx_games_slug` ON `games` (`slug`)";
  collection.indexes = collection.indexes.filter((index) => index !== uniqueIndex);

  return app.save(collection);
});
