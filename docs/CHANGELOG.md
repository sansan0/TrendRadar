# Changelog

All notable changes to this project are documented in separate version files.

## Version History

| Version                       | Date       | Summary                                          |
| ----------------------------- | ---------- | ------------------------------------------------ |
| [5.0.3](./changelog/5.0.3.md) | 2026-01-15 | ChannelFilter extension, notification scheduler  |
| [5.0.2](./changelog/5.0.2.md) | 2026-01-14 | Documentation reorganization, naming consistency |
| [5.0.1](./changelog/5.0.1.md) | 2026-01-14 | Extension plugin system, enhanced deduplication  |

## Version Format

Each version file (`X.Y.Z.md`) contains:

-   Release date
-   Change summary (Added, Changed, Removed, Fixed)
-   Technical details
-   Migration notes
-   Related issues

## Adding a New Version

1. Create new file: `docs/changelog/X.Y.Z.md`
2. Update this index with version info
3. Update `version` file: `pixi run version-bump-[patch|minor|major]`
4. Commit all changes

## Version Numbering

-   **Major**: Incompatible API changes
-   **Minor**: New features (backward compatible)
-   **Patch**: Bug fixes (backward compatible)

## Categories

| Category | Description                       |
| -------- | --------------------------------- |
| Added    | New features                      |
| Changed  | Changes in existing functionality |
| Removed  | Removed features                  |
| Fixed    | Bug fixes                         |
| Security | Security-related changes          |

## References

-   [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
-   [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
