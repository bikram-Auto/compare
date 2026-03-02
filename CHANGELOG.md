# Changelog

All notable changes to this project will be documented in this file.

---

## [v1.3.0] - February 27, 2026

### Added
- **Config Mode (`--config`)**: Execute multiple source → destination mappings from a JSON file
  - Supports multiple mappings in a single run
  - Ideal for microservice distribution and shared module replication
- **File Source Support in Config Mode**
  - `source` can now be either:
    - A folder
    - A single file
- **Deterministic Sync in Config Mode**
  - `--sync` now clears destination before copying
  - Works consistently for both file and folder sources
- **Automatic Destination Creation**
  - Creates destination directories if they do not exist
- **Config Variable Support**
  - Supports environment variables like `${HOME}`
  - Supports config-level variables like `${base}`

### Improved
- Unified behavior between CLI mode and config mode
- Consistent `--sync` semantics across all execution paths
- Enhanced path resolution logic for cross-platform compatibility
- Cleaner execution flow in `main()` with dedicated config processor

### Fixed
- Sync mode not triggering correctly in config mode (file source case)
- Incorrect destination handling when mapping file sources
- JSON validation clarity with improved error messaging

## [v1.2.0] - February 24, 2026

### Added
-  **--only flag**: Filter and copy/sync only specific files or folders
  - Copy single files: `--only "path/to/file.txt"`
  - Copy entire folders: `--only "foldername"`
  - Works with all modes: `--no-copy`, `--sync`
  - Examples: `./compair /src /dst --only "folder" --sync`
- Cross-platform path normalization for consistent behavior on Windows/macOS/Linux
- Enhanced console output for filtered operations
- Detailed error handling for edge cases in filtering

### Improved
- Better user feedback with "FILTER MODE" notification
- Path matching logic with prefix and nested path support
- Documentation updated with --only examples throughout

### Fixed
- Path separator handling in filtered operations
- Comprehensive error messages for invalid paths

---

## [v1.1.0] - Previous Release

### Added
- **Auto-Stack Optimization**: Automatically detects and optimizes for large directories (100k+ files)
  - Auto-calculates required stack size
  - Restarts process with optimized memory if needed
  - No user intervention required
- **Standalone Executables**: Native binaries for all major platforms
  - macOS ARM64 (Apple Silicon / M1+)
  - Linux x64 (64-bit Intel/AMD)
  - Windows x64 (64-bit)
  - No Node.js installation required
  - Single self-contained executable (36-44 MB)
  - Includes bundled Node.js runtime

### Improved
- Stack size calculation heuristic (2 MB per 1000 files)
- Memory management for deep directory structures
- Error handling for inaccessible files/folders

### Fixed
- "Maximum call stack size exceeded" errors with very large directories
- Respawn logic detection for pkg executables
- Console output suppression in bundled executables

### Tested With
- ✓ 137,000+ files in single directory
- ✓ 100,000+ file directories
- ✓ Nested folder structures of any depth
- ✓ Complex symlink scenarios
- ✓ Large external drives and cloud storage mounts

---

## [v1.0.0] - Initial Release

### Added
- **Core Functionality**:
  - Compare two folders recursively
  - Identify unique files in source and destination
  - Identify common files between folders
  - Display comprehensive comparison report

- **Three Operating Modes**:
  - **Safe Mode** (default): Copy only unique files from source
  - **Preview Mode** (--no-copy): Show changes without copying
  - **Sync Mode** (--sync): Full folder synchronization with deletion

- **Features**:
  - Handles nested folders and subdirectories
  - Maintains folder structure when copying
  - Detailed CSV-style reports
  - Error tracking and reporting
  - Symlink detection and handling
  - Progress indication for operations

- **Command-Line Options**:
  - `--no-copy`: Preview mode
  - `--sync`: Full synchronization mode

- **Cross-Platform Support**:
  - macOS (standalone or Node.js)
  - Linux (standalone or Node.js)
  - Windows batch wrapper included

- **Output Reports**:
  - Unique files in source
  - Common files between folders
  - Unique files in destination
  - Successfully copied files
  - Operation errors

- **Documentation**:
  - Comprehensive README with examples
  - Safety guide and best practices
  - Troubleshooting section
  - Real-world usage examples
  - Pro tips and tricks

### Specifications
- **Language**: TypeScript / Node.js
- **License**: MIT
- **Node.js Version**: 20.0.0+
- **File Size**: 7.8 KB (single-file version)
- **Dependencies**: None (self-contained bundles available)

---

## Version Summary

| Version | Release Date | Key Features | File Size |
|---------|--------------|--------------|-----------|
| v1.3.0 | Feb 27, 2026 | Config mode, file-source support, deterministic sync | 36-44 MB* |
| v1.2.0 | Feb 24, 2026 | --only flag for selective copying | 36-44 MB* |
| v1.1.0 | Previous | Auto-stack optimization, standalone binaries | 36-44 MB* |
| v1.0.0 | Initial | Core folder comparison & sync | 7.8 KB |

*Standalone executables with bundled Node.js

---

## Feature Matrix

| Feature | v1.0.0 | v1.1.0 | v1.2.0 | v1.3.0 |
|---------|--------|--------|--------|--------|
| Basic folder comparison | ✓ | ✓ | ✓ | ✓ |
| Safe copy mode | ✓ | ✓ | ✓ | ✓ |
| Preview mode (--no-copy) | ✓ | ✓ | ✓ | ✓ |
| Full sync mode (--sync) | ✓ | ✓ | ✓ | ✓ |
| Nested folders | ✓ | ✓ | ✓ | ✓ |
| Auto-stack optimization | | ✓ | ✓ | ✓ |
| Standalone executables | | ✓ | ✓ | ✓ |
| 100k+ files support | | ✓ | ✓ | ✓ |
| Filter mode (--only) | | | ✓ | ✓ |
| Config mode (--config) | | | | ✓ |
| File source in config | | | | ✓ |
| Multi-destination mapping | | | | ✓ |

---

## Platform Support

### v1.2.0
- macOS ARM64 (Apple Silicon / M1+) - Standalone executable
- Linux x64 (64-bit Intel/AMD) - Standalone executable
- Windows x64 (64-bit) - Standalone executable
- Node.js 20.0.0+ (any platform)

### v1.1.0
- macOS (Intel & Apple Silicon)
- Linux (x64)
- Windows (x64)
- Node.js 20.0.0+

### v1.0.0
- macOS
- Linux
- Windows
- Node.js 20.0.0+

---

## Migration Guide

### From v1.0.0 to v1.1.0
No breaking changes. The auto-stack optimization runs automatically.

### From v1.1.0 to v1.2.0
No breaking changes. New `--only` flag is optional.

**New capabilities in v1.2.0**:
```bash
# Selective copy (new)
./compair /src /dst --only "folder"

# Selective with preview (new)
./compair /src /dst --only "folder" --no-copy

# Selective sync (new)
./compair /src /dst --only "folder" --sync
```

---

## Known Issues

### v1.2.0
- None reported

### v1.1.0
- None reported

### v1.0.0
- "Maximum call stack size exceeded" with 100k+ files (resolved in v1.1.0)

---

## Future Roadmap

Potential enhancements for future releases:
- Glob pattern support: `--only "*.json"`
- Multiple filters: `--only "folder1" --only "folder2"`
- Exclude patterns: `--exclude "node_modules"`
- Regex support: `--only "regex:^[0-9]{2}-.*"`
- Incremental/differential sync
- Compression during transfer
- Remote sync over SSH/FTP
- Scheduling and cron integration
- GUI/Web interface

