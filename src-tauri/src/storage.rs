use serde::Serialize;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
pub const LIMIT: usize = 2 * 1024 * 1024;
pub struct Storage {
    pub root: PathBuf,
    pub legacy: PathBuf,
    pub lock: Mutex<()>,
}
#[derive(Serialize)]
pub struct Loaded {
    pub raw: Option<String>,
    pub migrated: bool,
    pub legacy_error: bool,
}
fn read(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }
    if fs::metadata(path).map_err(|_| "read")?.len() > LIMIT as u64 {
        return Err("size".into());
    }
    fs::read_to_string(path)
        .map(Some)
        .map_err(|_| "read".into())
}
pub fn load(storage: &Storage) -> Result<Loaded, String> {
    let _lock = storage.lock.lock().map_err(|_| "lock")?;
    if let Some(raw) = read(&storage.root.join("ledger.json"))? {
        return Ok(Loaded {
            raw: Some(raw),
            migrated: false,
            legacy_error: false,
        });
    }
    match read_legacy(&storage.legacy) {
        Ok(raw) => Ok(Loaded {
            migrated: raw.is_some(),
            raw,
            legacy_error: false,
        }),
        Err(_) => Ok(Loaded {
            raw: None,
            migrated: false,
            legacy_error: true,
        }),
    }
}
pub fn save(storage: &Storage, content: &str, expected: Option<&str>) -> Result<(), String> {
    if content.len() > LIMIT {
        return Err("size".into());
    }
    let json: serde_json::Value = serde_json::from_str(content).map_err(|_| "invalid")?;
    if json["version"] != 1 || !json["services"].is_array() || !json["payments"].is_array() {
        return Err("invalid".into());
    }
    let _lock = storage.lock.lock().map_err(|_| "lock")?;
    let path = storage.root.join("ledger.json");
    let current = read(&path)?;
    if current.as_deref() != expected {
        return Err("conflict".into());
    }
    fs::create_dir_all(&storage.root).map_err(|_| "write")?;
    let mut temp = tempfile::NamedTempFile::new_in(&storage.root).map_err(|_| "write")?;
    temp.write_all(content.as_bytes()).map_err(|_| "write")?;
    temp.as_file().sync_all().map_err(|_| "write")?;
    temp.persist(path).map_err(|_| "write")?;
    Ok(())
}
fn decode(value: &[u8]) -> Result<String, String> {
    match value.first() {
        Some(1) => Ok(value[1..].iter().map(|b| char::from(*b)).collect()),
        Some(0) if (value.len() - 1) % 2 == 0 => String::from_utf16(
            &value[1..]
                .chunks_exact(2)
                .map(|b| u16::from_le_bytes([b[0], b[1]]))
                .collect::<Vec<_>>(),
        )
        .map_err(|_| "encoding".into()),
        _ => Err("encoding".into()),
    }
}
// Never open the original DB for writing. Recover from a bounded disposable copy only.
pub fn read_legacy(source: &Path) -> Result<Option<String>, String> {
    if !source.exists() {
        return Ok(None);
    }
    let copy = tempfile::tempdir().map_err(|_| "copy")?;
    let mut size = 0u64;
    let mut count = 0usize;
    for entry in fs::read_dir(source).map_err(|_| "copy")? {
        let entry = entry.map_err(|_| "copy")?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !(name == "CURRENT"
            || name.starts_with("MANIFEST-")
            || name.ends_with(".ldb")
            || name.ends_with(".sst")
            || name.ends_with(".log"))
        {
            continue;
        }
        if !entry.file_type().map_err(|_| "copy")?.is_file() {
            return Err("copy".into());
        }
        size += entry.metadata().map_err(|_| "copy")?.len();
        count += 1;
        if size > 128 * 1024 * 1024 || count > 512 {
            return Err("size".into());
        }
        fs::copy(entry.path(), copy.path().join(name.as_ref())).map_err(|_| "copy")?;
    }
    let options = rusty_leveldb::Options {
        create_if_missing: false,
        ..Default::default()
    };
    let mut db = rusty_leveldb::DB::open(copy.path(), options).map_err(|_| "legacy")?;
    let key = b"_billing-memo://app\0\x01billing-memo.ledger.v1";
    let raw = db.get(key).map(|value| decode(&value)).transpose()?;
    db.close().map_err(|_| "legacy")?;
    if raw.as_ref().is_some_and(|s| s.len() > LIMIT) {
        return Err("size".into());
    }
    Ok(raw)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn state(root: &Path) -> Storage {
        Storage {
            root: root.join("new"),
            legacy: root.join("old"),
            lock: Mutex::new(()),
        }
    }
    const EMPTY: &str = r#"{"version":1,"services":[],"payments":[]}"#;
    #[test]
    fn fresh_and_atomic_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let s = state(dir.path());
        assert!(load(&s).unwrap().raw.is_none());
        save(&s, EMPTY, None).unwrap();
        assert_eq!(load(&s).unwrap().raw.as_deref(), Some(EMPTY));
        assert_eq!(save(&s, EMPTY, None).unwrap_err(), "conflict");
        save(&s, EMPTY, Some(EMPTY)).unwrap();
    }
    #[test]
    fn malformed_and_oversized_not_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let s = state(dir.path());
        save(&s, EMPTY, None).unwrap();
        assert!(save(&s, "broken", Some(EMPTY)).is_err());
        assert!(save(&s, &"x".repeat(LIMIT + 1), Some(EMPTY)).is_err());
        assert_eq!(load(&s).unwrap().raw.as_deref(), Some(EMPTY));
    }
    #[test]
    fn legacy_copy_preserves_original_and_ignores_demo() {
        let dir = tempfile::tempdir().unwrap();
        let s = state(dir.path());
        let mut db = rusty_leveldb::DB::open(&s.legacy, Default::default()).unwrap();
        let key = b"_billing-memo://app\0\x01billing-memo.ledger.v1";
        let raw = format!("\x01{}", EMPTY);
        db.put(key, raw.as_bytes()).unwrap();
        db.flush().unwrap();
        db.close().unwrap();
        assert_eq!(read_legacy(&s.legacy).unwrap().as_deref(), Some(EMPTY));
        assert!(!s.root.exists());
        let mut original = rusty_leveldb::DB::open(&s.legacy, Default::default()).unwrap();
        assert_eq!(original.get(key).unwrap(), raw.as_bytes());
        original.delete(key).unwrap();
        original.flush().unwrap();
        original.close().unwrap();
        assert_eq!(read_legacy(&s.legacy).unwrap(), None);
    }
    #[test]
    fn unicode_storage_formats() {
        assert_eq!(decode(&[1, 65, 233]).unwrap(), "Aé");
        assert_eq!(decode(&[0, 0x1c, 0xac]).unwrap(), "개");
        assert!(decode(&[0, 1]).is_err());
    }
}
