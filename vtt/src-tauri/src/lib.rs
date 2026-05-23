mod image_processing;

use tauri::Manager;

#[tauri::command]
async fn process_token_image(
    app: tauri::AppHandle,
    source_path: String,
    shape: String,
    grid_squares: u32,
    cell_px: f32,
) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        image_processing::process_token(&source_path, &shape, grid_squares, cell_px, &data_dir)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn process_map_image(
    app: tauri::AppHandle,
    source_path: String,
    operation: image_processing::MapOperation,
) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        image_processing::process_map(&source_path, operation, &data_dir)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            process_token_image,
            process_map_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
