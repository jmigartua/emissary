use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(serde::Serialize)]
struct Dataset {
    path: String,
    bundled: bool,
    papers: Vec<serde_json::Value>,
    graph: Option<serde_json::Value>,
}

/// Accepts the repo root, its `data/` dir, or the `papers/` dir itself.
fn resolve_papers_dir(dir: &Path) -> Option<PathBuf> {
    for candidate in [
        dir.join("papers"),
        dir.join("data").join("papers"),
        dir.to_path_buf(),
    ] {
        if candidate.is_dir()
            && fs::read_dir(&candidate).map_or(false, |mut d| {
                d.any(|e| {
                    e.map_or(false, |e| {
                        e.path().extension().map_or(false, |x| x == "json")
                    })
                })
            })
        {
            // The repo root itself has no loose .json record files, so only
            // accept `dir` directly when it already looks like a papers dir.
            if candidate == dir && !dir.ends_with("papers") {
                continue;
            }
            return Some(candidate);
        }
    }
    None
}

fn read_dataset(dir: &Path, bundled: bool) -> Result<Dataset, String> {
    let papers_dir = resolve_papers_dir(dir).ok_or_else(|| {
        format!(
            "No papers/*.json found under {} — pick the repo checkout, its data/ folder, or the papers/ folder.",
            dir.display()
        )
    })?;

    let mut papers = Vec::new();
    let mut entries: Vec<_> = fs::read_dir(&papers_dir)
        .map_err(|e| format!("Cannot read {}: {e}", papers_dir.display()))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map_or(false, |x| x == "json"))
        .collect();
    entries.sort();
    for path in entries {
        let text = fs::read_to_string(&path)
            .map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
        match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(v) => papers.push(v),
            Err(e) => return Err(format!("Invalid JSON in {}: {e}", path.display())),
        }
    }
    if papers.is_empty() {
        return Err(format!("{} contains no records", papers_dir.display()));
    }

    let graph = papers_dir
        .parent()
        .map(|d| d.join("graph.json"))
        .filter(|p| p.is_file())
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok());

    Ok(Dataset {
        path: papers_dir
            .parent()
            .unwrap_or(&papers_dir)
            .display()
            .to_string(),
        bundled,
        papers,
        graph,
    })
}

#[tauri::command]
fn load_dataset(app: tauri::AppHandle, path: Option<String>) -> Result<Dataset, String> {
    match path {
        Some(p) => read_dataset(Path::new(&p), false),
        None => {
            let resource = app
                .path()
                .resolve("resources/data", tauri::path::BaseDirectory::Resource)
                .map_err(|e| format!("Bundled dataset not found: {e}"))?;
            read_dataset(&resource, true)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_dataset])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
