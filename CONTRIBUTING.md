# Contributing to BooVoice

Thanks for helping improve BooVoice. Bug reports, documentation fixes, and focused
pull requests are welcome.

## Before contributing

- Search existing issues and pull requests before opening a duplicate.
- Use the security process in [SECURITY.md](SECURITY.md) for vulnerabilities.
- Never include a Discord bot token or the contents of `data/store.json` in an
  issue, commit, screenshot, log, or test fixture.

## Local setup

Use Node.js 22 or newer, then run:

```bash
npm ci
Copy-Item .env.example .env # PowerShell
npm run check
npm test
```

The bot itself needs a development application token in `.env`. Unit tests and
syntax checks do not need a token.

## Pull requests

1. Create a branch from `main`.
2. Keep the change focused and update documentation and tests when behavior
   changes.
3. Run `npm run check`, `npm test`, and `npm audit --omit=dev`.
4. Explain the user-visible behavior and how the change was verified.

JavaScript uses two-space indentation, single quotes, semicolons, and trailing
commas where the surrounding code uses them. Avoid drive-by formatting changes.

By contributing, you agree that your contribution is licensed under the project's
[ISC License](LICENSE).
