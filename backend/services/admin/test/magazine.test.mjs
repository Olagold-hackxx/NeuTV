import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { testStore } from '../../../platform/db/testing.mjs';
import { openAdminStore } from '../store.mjs';
import { createMagazine } from '../magazine.mjs';

const EDITOR = 'admin-1';
const FILE = 'https://cdn.example.com/e-news/issue-01.pdf';
const COVER = 'https://cdn.example.com/e-news/issue-01-cover.jpg';

const build = async () => createMagazine({ runtime: fakeRuntime(), store: await testStore(openAdminStore) });

test('an issue is drafted, published, and only then on the shelf', async () => {
  const mag = await build();
  const { issue } = await mag.create(EDITOR, { title: 'E-News #1', coverUrl: COVER, fileUrl: FILE, issueNumber: 1 });
  assert.equal(issue.status, 'draft');

  // Drafts are the editor's business.
  assert.equal((await mag.listPublished()).issues.length, 0);
  await assert.rejects(() => mag.getPublished(issue.id), /No magazine issue/);

  await mag.update(issue.id, { status: 'published' });
  const shelf = (await mag.listPublished()).issues;
  assert.equal(shelf.length, 1);
  assert.equal(shelf[0].fileUrl, FILE);
  assert.ok(shelf[0].publishedAt, 'publishing stamps the date');
  assert.ok(!('createdBy' in shelf[0]), 'no editorial fields on the public shape');
});

test('publishing needs something behind the cover', async () => {
  const mag = await build();
  const { issue } = await mag.create(EDITOR, { title: 'Vapourware Monthly', coverUrl: COVER });
  await assert.rejects(() => mag.update(issue.id, { status: 'published' }), /file URL/);
  // Supplying the file in the same edit is fine.
  const { issue: out } = await mag.update(issue.id, { status: 'published', fileUrl: FILE });
  assert.equal(out.status, 'published');
});

test('the shelf is newest first and an archived issue keeps its link', async () => {
  const mag = await build();
  const runtime = { clock: null };
  const a = (await mag.create(EDITOR, { title: 'E-News #1', fileUrl: FILE })).issue;
  const b = (await mag.create(EDITOR, { title: 'E-News #2', fileUrl: FILE })).issue;
  await mag.update(a.id, { status: 'published' });
  await mag.update(b.id, { status: 'published' });
  const shelf = (await mag.listPublished()).issues;
  assert.deepEqual(shelf.map((i) => i.title).sort(), ['E-News #1', 'E-News #2']);

  await mag.update(a.id, { status: 'archived' });
  assert.equal((await mag.listPublished()).issues.length, 1, 'off the shelf');
  assert.equal((await mag.getPublished(a.id)).issue.title, 'E-News #1', 'link still answers');
});

test('a published issue cannot be deleted, only archived first', async () => {
  const mag = await build();
  const { issue } = await mag.create(EDITOR, { title: 'E-News #1', fileUrl: FILE });
  await mag.update(issue.id, { status: 'published' });
  await assert.rejects(() => mag.remove(issue.id), /Archive it before deleting/);
  await mag.update(issue.id, { status: 'archived' });
  await mag.remove(issue.id);
  await assert.rejects(() => mag.getPublished(issue.id), /No magazine issue/);
});

test('urls must be urls', async () => {
  const mag = await build();
  await assert.rejects(
    () => mag.create(EDITOR, { title: 'E-News #1', fileUrl: 'not-a-url' }),
    /http\(s\) URL/,
  );
});
