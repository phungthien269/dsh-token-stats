# Changelog

## 0.2.1

- **English is the primary language** — the dashboard opens in English unless another language is picked in the header picker; the first-run browser-language auto-detect was removed.

## 0.2.0

- **Multi-language UI** — the dashboard and sidebar entry are now fully translated into Tiếng Việt, English, 中文 and 日本語. A language picker sits in the dashboard header; the choice persists in localStorage and the first-run default follows the browser language.
- Date/week/month labels render with the selected locale's `Intl.DateTimeFormat` (host timezone unchanged).
- Package prepared for the Plugin Market: npm `files` allowlist, keywords, repository metadata, trilingual README, MIT LICENSE, this changelog.

## 0.1.0

- Initial release: sidebar entry + center-column dashboard, Today/Week/Month/All-time cards, stacked-by-model SVG chart (30 days / 12 weeks / 12 months), per-model table, 30 s auto-refresh, read-only over the Wallet 365-day ledger.
- Sidebar integration for the dsh 0.1.1-rc.2 `dcu` sidebar (expanded menu + compact rail) with legacy-shell fallback.
