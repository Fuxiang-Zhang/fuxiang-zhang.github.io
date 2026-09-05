import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSiteData, parseSiteData, siteFiles, type SiteData } from '../src/types.js';
import { readLocal, site } from './helpers.js';

test('loading preserves every field from the source files', async () => {
  assert.deepEqual(site, {
    ...await readLocal(siteFiles.profile),
    publications: await readLocal(siteFiles.publications),
    ...await readLocal(siteFiles.cv),
  });
});

test('invalid records, duplicate paper ids and broken references are rejected', () => {
  const broken = (patch: (copy: SiteData) => void) => {
    const copy = structuredClone(site);
    patch(copy);
    return copy;
  };
  for (const invalid of [null, {}, { ...site, publications: [{ id: 'incomplete' }] },
    broken(s => { s.experience[0].contributions![0].paperId = 'missing'; }),
    broken(s => { s.publications.push({ ...s.publications[0] }); }),
    broken(s => { s.publications[0].year = 2025.5; }),
    { ...site, awards: [{ ...site.awards[0], period: 2020 }] },
    { ...site, interests: [{ title: 'Invalid', description: 1 }] },
    { ...site, publications: [{ ...site.publications[0], topic: 'unknown' }] },
  ]) assert.throws(() => parseSiteData(invalid));
});

test('missing or malformed source data is reported instead of silently omitted', async () => {
  await assert.rejects(loadSiteData(async path => path === siteFiles.cv ? [] : readLocal(path)));
  await assert.rejects(loadSiteData(async path => {
    if (path === siteFiles.publications) throw new Error('Unavailable publication data');
    return readLocal(path);
  }), /Unavailable publication data/);
});
