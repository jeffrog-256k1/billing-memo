#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod storage;
use std::{path::PathBuf, sync::Mutex};
use storage::{Loaded, Storage, LIMIT};
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
#[tauri::command]
fn load_workspace(storage: State<'_, Storage>) -> Result<Loaded, String> {
    storage::load(&storage)
}
#[tauri::command]
fn save_workspace(
    storage: State<'_, Storage>,
    content: String,
    expected: Option<String>,
) -> Result<(), String> {
    storage::save(&storage, &content, expected.as_deref())
}
#[tauri::command]
async fn export_file(content: String, filename: String) -> Result<bool, String> {
    if content.len() > 16 * 1024 * 1024
        || !filename.starts_with("billing-memo-")
        || !filename
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-._".contains(&b))
    {
        return Err("invalid".into());
    }
    let ext = filename.rsplit('.').next().unwrap_or("");
    if !["json", "csv", "ics"].contains(&ext) {
        return Err("invalid".into());
    }
    let file = rfd::AsyncFileDialog::new()
        .set_title("Billing Memo")
        .set_file_name(&filename)
        .add_filter(ext, &[ext])
        .save_file()
        .await;
    if let Some(file) = file {
        file.write(content.as_bytes()).await.map_err(|_| "write")?;
        return Ok(true);
    }
    Ok(false)
}
#[tauri::command]
async fn import_file() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Billing Memo — JSON")
        .add_filter("JSON", &["json"])
        .pick_file()
        .await;
    if let Some(file) = file {
        if std::fs::metadata(file.path()).map_err(|_| "read")?.len() > LIMIT as u64 {
            return Err("size".into());
        }
        return String::from_utf8(file.read().await)
            .map(Some)
            .map_err(|_| "encoding".into());
    }
    Ok(None)
}
#[tauri::command]
async fn open_link(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "url")?;
    if url.len() > 2000
        || parsed.scheme() != "https"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("url".into());
    }
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|_| "open".into())
}
fn main() {
    let args: Vec<String> = std::env::args().collect();
    let profile = args
        .windows(2)
        .find(|a| a[0] == "--data-dir")
        .map(|a| PathBuf::from(&a[1]));
    let custom_profile = profile.is_some();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            export_file,
            import_file,
            open_link
        ])
        .setup(move |app| {
            let root = profile.clone().unwrap_or(app.path().app_data_dir()?);
            std::fs::create_dir_all(&root)?;
            let legacy = if custom_profile {
                root.join("legacy/Local Storage/leveldb")
            } else {
                app.path()
                    .data_dir()?
                    .join("Billing Memo/Local Storage/leveldb")
            };
            app.manage(Storage {
                root: root.clone(),
                legacy,
                lock: Mutex::new(()),
            });
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Billing Memo")
                .inner_size(1280., 880.)
                .min_inner_size(760., 620.)
                .data_directory(root.join("webview"))
                .on_navigation(|url| {
                    url.scheme() == "tauri"
                        || (url.host_str() == Some("tauri.localhost")
                            && ["http", "https"].contains(&url.scheme()))
                })
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .on_permission_request(|_, _| tauri::webview::PermissionResponse::Deny)
                .on_download(|_, _| false)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Unable to start Billing Memo");
}
