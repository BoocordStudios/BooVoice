'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_TEMPLATE,
  MAX_CHANNEL_NAME_LENGTH,
  applyTemplate,
} = require('../src/template');

const context = {
  username: 'boo',
  displayName: 'Boo Bear',
  userId: '123456789',
  guildName: 'Boocord',
  count: 3,
};

test('expands every supported placeholder', () => {
  const template = '%username | %displayname | %userid | %guildname | %count';

  assert.equal(
    applyTemplate(template, context),
    'boo | Boo Bear | 123456789 | Boocord | 3',
  );
});

test('expands repeated placeholders without interpreting replacement characters', () => {
  assert.equal(
    applyTemplate('%username + %username', { ...context, username: '$&boo' }),
    '$&boo + $&boo',
  );
});

test('uses the default template when no template is supplied', () => {
  assert.equal(applyTemplate(undefined, context), "boo's Channel");
  assert.equal(DEFAULT_TEMPLATE, "%username's Channel");
});

test('falls back to a useful name when the rendered template is blank', () => {
  assert.equal(applyTemplate('   ', context), "boo's Channel");
  assert.equal(applyTemplate('   ', {}), "User's Channel");
});

test('limits channel names to 100 Unicode characters', () => {
  const result = applyTemplate('👻'.repeat(MAX_CHANNEL_NAME_LENGTH + 1), context);

  assert.equal(Array.from(result).length, MAX_CHANNEL_NAME_LENGTH);
  assert.equal(result, '👻'.repeat(MAX_CHANNEL_NAME_LENGTH));
});
