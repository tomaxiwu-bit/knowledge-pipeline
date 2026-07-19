# Release Checklist

## Automated gate

Run this before creating a release tag:

```bash
npm ci
npm run release:check
npm run electron:build
```

The tag workflow builds native release artifacts on Linux, macOS, and Windows and keeps them as CI artifacts for review.

## Manual acceptance path

On every supported operating system, confirm this complete path with real self-hosted services:

1. Add FreshRSS, Karakeep, Memos, and (optionally) an AI provider; use **测试全部连接**.
2. Open a RSS item, add it to a new **探究线** as evidence, and add a bookmark as a counterpoint.
3. Save a reflection; verify it appears as a normal memo and inside the thread.
4. Save the current judgment and next action, then export the Markdown brief.
5. Export a local backup, verify its JSON contains no API key/token/password, then restore it in a clean profile.
6. Disable one backend briefly and confirm cached reads are timestamped as offline data rather than shown as live results.

## Signing and distribution

- Add platform signing credentials to the release environment before public distribution: Windows code-signing certificate, Apple Developer signing/notarization credentials, and any Linux packaging key used by the chosen channel.
- Replace the placeholder installer icon with product-owned platform assets.
- Do not publish an unsigned build as a trusted production release; CI artifacts are for validation until signing is configured.

## Release notes should state

- Supported operating systems and the exact app version.
- That credentials are stored locally and excluded from backup exports.
- Which self-hosted services and API versions were manually tested.
- Any known limits, including the seven-day read-only cache boundary.
