# Security Policy

Lamplight is a static website. It has no server, no database, no user accounts and no analytics. Each reader's notes
and bookmarks are stored only in their own browser (`localStorage`).

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** on this repository (Security tab, then "Report a vulnerability").
Please don't open a public issue. You can expect a reply within a week.

## Practices in this repo

- Dependabot alerts and security updates are enabled for npm and GitHub Actions.
- Secret scanning with push protection is enabled. Never commit `.env` files, keys or tokens.
- The `main` branch is protected against force-pushes and deletion.
- The deploy workflow runs with least-privilege permissions (`contents: read`, `pages: write`, `id-token: write`).
