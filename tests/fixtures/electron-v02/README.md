# Synthetic migration fixture

Created in a fresh, isolated Billing Memo 0.2.0 Electron profile. The only saved localStorage value is `billing-memo.ledger.v1`, containing the fictional service and payment in `expected.json`. The Korean service suffix exercises Chromium's UTF-16 storage format. These files contain no real ledger, account or browser data.

The native integration test copies the LevelDB files into its own temporary profile, checks migration into native JSON and verifies that every original database file retains its SHA-256 hash.
