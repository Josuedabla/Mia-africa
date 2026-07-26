-- ============================================================
-- MIA Marketplace — Migration 001: Extensions
-- ============================================================
-- pgcrypto  -> gen_random_uuid() for all primary keys
-- postgis   -> geography(Point,4326) columns + distance/radius search
-- vector    -> pgvector, for future semantic product search (embeddings)
-- pg_trgm   -> trigram similarity, powers fast fuzzy/typo-tolerant search
--              on product/shop names without needing a third-party
--              search service (this replaces Algolia entirely - see
--              migration 007_search_and_geo.sql for the search functions)
create extension if not exists pgcrypto;
create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists pg_trgm;
