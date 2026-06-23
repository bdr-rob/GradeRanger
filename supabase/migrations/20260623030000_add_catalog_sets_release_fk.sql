-- Adds a real FK from catalog_sets.release_id -> catalog_releases.id so
-- PostgREST can do an embedded join (catalog_releases!inner(segment_id)) to
-- filter sets by segment. The Catalog page previously filtered by fetching
-- every release_id for a segment client-side and passing it to .in(...) —
-- for segments with hundreds of releases (e.g. Basketball, Baseball) that
-- list blew past PostgREST's URL length limit and the request just failed.
--
-- NOT VALID since catalog_sets may have been synced before catalog_releases
-- and could contain release_ids not yet present locally — this still lets
-- PostgREST use the relationship for embedding without requiring every
-- existing row to satisfy it up front.
ALTER TABLE catalog_sets
  ADD CONSTRAINT catalog_sets_release_id_fkey
  FOREIGN KEY (release_id) REFERENCES catalog_releases(id) NOT VALID;
