# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1.0] - 2026-05-09

### Added
- Initial React Native / TypeScript project skeleton with DDD structure.
- Universal Transaction Engine placeholder with basic Regex parsing.
- Vitest testing framework with 100% coverage on core logic.
- GitHub Actions CI/CD workflow for automated testing.

### Fixed
- Catastrophic data corruption bug where amounts with commas were parsed incorrectly.
- Financial precision loss by switching to integer-based minor units (paise).
- Support for negative transaction values (refunds/reversals).
- Regex injection vulnerability by escaping currency symbols.
