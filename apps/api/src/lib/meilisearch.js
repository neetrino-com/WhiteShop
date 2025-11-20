const { MeiliSearch } = require('meilisearch');

const searchClient = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY,
});

module.exports = { searchClient };

