const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPlacesService } = require('../services/walkability');
const response = elements => ({ ok: true, json: async () => ({ elements }) });
const school = { type: 'node', id: 1, lat: 9, lon: -79, tags: { amenity: 'school', name: 'Escuela de prueba' } };

test('normalizes points and centers, removes duplicate OSM identities and rejects unknown categories', async () => {
  const get = createPlacesService({ fetchImpl: async () => response([school, school,
    { type: 'way', id: 2, center: {lat: 9, lon: -79}, tags: {leisure: 'park'} },
    { type: 'node', id: 3, lat: 9, lon: -79, tags: {amenity: 'parking'} }
  ]) });
  const result = await get();
  assert.equal(result.places.length, 2);
  assert.equal(result.places.find(p => p.id === 'way/2').locationType, 'geometry-center');
  assert.equal(result.places.find(p => p.id === 'node/1').category, 'education');
});

test('shares concurrent calls and reuses a fresh cache', async () => {
  let calls = 0;
  const get = createPlacesService({fetchImpl: async () => {calls++; return response([school]);}});
  await Promise.all([get(), get(), get()]);
  await get();
  assert.equal(calls, 1);
});

test('on upstream failure sends unavailable, not an empty inventory; retries after cooldown', async () => {
  let clock = 0, calls = 0;
  const get = createPlacesService({now: () => clock, fetchImpl: async () => { calls++; throw new Error('network'); }});
  for (let i = 0; i < 2; i++) await assert.rejects(get(), e => e.status === 503 && e.retryAfter === 60);
  assert.equal(calls, 1);
  clock = 61000;
  await assert.rejects(get());
  assert.equal(calls, 2);
});

test('expired cached data is retained and marked stale after failure', async () => {
  let clock = 0, fail = false;
  const get = createPlacesService({now: () => clock, fetchImpl: async () => {if (fail) throw new Error('offline'); return response([school]);}});
  const first = await get();
  clock = 31 * 60 * 1000; fail = true;
  const stale = await get();
  assert.equal(stale.cache.stale, true);
  assert.deepEqual(stale.places, first.places);
  assert.equal(stale.fetchedAt, first.fetchedAt);
});

test('rejects incomplete Overpass success responses rather than caching partial data', async () => {
  for (const data of [{remark: 'runtime timeout', elements: [school]}, {}]) {
    const get = createPlacesService({fetchImpl: async () => ({ok: true, json: async () => data})});
    await assert.rejects(get(), e => e.status === 503);
  }
});

test('a successful empty inventory remains distinguishable from unavailability', async () => {
  const get = createPlacesService({fetchImpl: async () => response([])});
  const result = await get();
  assert.deepEqual(result.places, []);
  assert.equal(result.cache.stale, false);
});
