# Event assets

Event photos and program PDFs served at `/events/*` are **deployment-supplied
assets**. They are farm-specific content and are never committed to this
open-source repository.

To use the Events page, place your asset files in this directory in your
private deployment (or overlay them at deploy time) and reference them from
your farm config (`events` in `src/farms/local.config.ts`).
