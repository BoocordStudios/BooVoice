'use strict';

const DEFAULT_TEMPLATE = "%username's Channel";
const MAX_CHANNEL_NAME_LENGTH = 100;

const PLACEHOLDERS = Object.freeze({
  '%username': 'username',
  '%displayname': 'displayName',
  '%userid': 'userId',
  '%guildname': 'guildName',
  '%count': 'count',
});

function applyTemplate(template, context) {
  let result = typeof template === 'string' ? template : DEFAULT_TEMPLATE;

  for (const [placeholder, contextKey] of Object.entries(PLACEHOLDERS)) {
    const value = String(context?.[contextKey] ?? '');
    result = result.split(placeholder).join(value);
  }

  result = result.trim();

  if (!result) {
    const username = String(context?.username ?? '').trim() || 'User';
    result = `${username}'s Channel`;
  }

  return Array.from(result).slice(0, MAX_CHANNEL_NAME_LENGTH).join('');
}

module.exports = {
  DEFAULT_TEMPLATE,
  MAX_CHANNEL_NAME_LENGTH,
  PLACEHOLDERS,
  applyTemplate,
};
