# Food photos

There are no bundled food photos right now. The app shows **dummy remote images** (dev placeholders chosen by the team) set in `src/data/mock/foodImages.ts`, keyed by item id. Items without one render the grey placeholder card.

Before any release, replace every dummy URL with owned or licensed photos, or with the catalog's Supabase Storage URLs (`src/services/foodImageSource.ts`, `USE_REMOTE_IMAGES`). Record the source of each stock photo in `CREDITS.md`.
