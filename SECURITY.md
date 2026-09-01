# Security policy

## Supported versions

Security fixes are provided for the latest release on the `1.x` line. Users
should upgrade to the newest available patch release before reporting an issue.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use
[GitHub's private vulnerability reporting](https://github.com/BoocordStudios/BooVoice/security/advisories/new)
to share the affected version, impact, reproduction steps, and any suggested fix.

Maintainers aim to acknowledge a complete report within seven days. Please allow
time for a fix and coordinated release before publishing details.

## Protecting credentials and runtime data

Never share a Discord bot token. If one is exposed, reset it immediately in the
Discord Developer Portal. Treat `data/store.json` as private because it contains
Discord guild, channel, and user IDs.
