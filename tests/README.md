# Testing Documentation

This directory contains the test suite for the Obsidian File Share plugin.

## Overview

The test suite uses **Jest** with **TypeScript support** (via ts-jest) to ensure the reliability and correctness of the plugin's core functionality.

## Test Structure

```
tests/
├── __mocks__/              # Mock implementations
│   └── obsidian.ts         # Mock for Obsidian API
├── unit/                   # Unit tests
│   ├── Secure.test.ts              # Cryptography & security tests
│   ├── FileValidator.test.ts       # File validation tests
│   └── FileRequestQueue.test.ts    # Request queue tests
└── integration/            # Integration tests
    └── EndToEndWorkflow.test.ts    # End-to-end workflow tests
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (auto-rerun on changes)
```bash
npm run test:watch
```

### With Coverage Report
```bash
npm run test:coverage
```

### Verbose Output
```bash
npm run test:verbose
```

## Test Coverage

### Secure.ts (42 tests)
Tests for cryptographic operations and security features:

- **Key Generation** (3 tests)
  - RSA-2048 key pair generation
  - Unique key generation
  - Key size validation

- **Public Key Serialization** (2 tests)
  - Base64 encoding/decoding
  - Round-trip serialization

- **File Signing & Verification** (3 tests)
  - Signature creation and validation
  - Tampered content detection
  - Wrong key detection

- **Data Signing** (2 tests)
  - Consistent signature generation
  - Different data produces different signatures

- **Hash Generation** (2 tests)
  - Consistent hashing
  - Different inputs produce different hashes

- **File Encryption & Decryption** (3 tests)
  - Full encrypt/decrypt cycle
  - Random IV/key generation
  - Wrong key rejection

- **Chunked File Encryption** (5 tests)
  - Large file chunking
  - Unique file ID generation
  - Metadata verification
  - Single chunk handling
  - Null file handling

- **End-to-End Workflows** (2 tests)
  - Complete encrypt-sign-verify-decrypt workflow
  - Tampered data detection

### FileValidator.ts (49 tests)
Tests for file type and size validation:

### FileRequestQueue.ts (29 tests)
Tests for file transfer request management:

## Mock System

### Obsidian API Mocks (`tests/__mocks__/obsidian.ts`)

Provides mock implementations of:
- `Notice` - User notifications
- `Plugin` - Plugin base class
- `PluginSettingTab` - Settings UI
- `Modal` & `SuggestModal` - Dialog boxes
- `Setting` - Settings controls
- `TFile` & `TFolder` - File system abstractions
- `Vault` - File operations
- `normalizePath` - Path normalization

These mocks allow testing without a running Obsidian instance.
