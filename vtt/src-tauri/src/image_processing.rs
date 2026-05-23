use photon_rs::transform::{self, SamplingFilter};
use photon_rs::PhotonImage;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MapOperation {
    Resize1080,
    Crop { x: u32, y: u32, width: u32, height: u32 },
}

// ---------------------------------------------------------------------------
// Public entry points (called from Tauri commands)
// ---------------------------------------------------------------------------

pub fn process_token(
    source_path: &str,
    shape: &str,
    grid_squares: u32,
    cell_px: f32,
    data_dir: &Path,
) -> Result<String, String> {
    let assets_dir = ensure_assets_dir(data_dir)?;
    let mut img = load_image(source_path)?;

    // 1. Square-crop from centre before resize so the mask is always circular
    img = square_crop_centre(img);

    // 2. Resize to calibrated grid size (skip if calibration not done)
    let target = (grid_squares as f32 * cell_px).round() as u32;
    if target > 0 {
        img = transform::resize(&img, target, target, SamplingFilter::Lanczos3);
    }

    // 3. Shape mask
    img = match shape {
        "circle" => apply_circle_mask(img),
        "rounded" => apply_rounded_corners(img, 0.15),
        _ => img,
    };

    let out = assets_dir.join(output_name(source_path, "token"));
    save_png(img, &out)?;
    Ok(out.to_string_lossy().into_owned())
}

pub fn process_map(
    source_path: &str,
    operation: MapOperation,
    data_dir: &Path,
) -> Result<String, String> {
    let assets_dir = ensure_assets_dir(data_dir)?;
    let mut img = load_image(source_path)?;

    img = match operation {
        MapOperation::Resize1080 => {
            transform::resize(&img, 1920, 1080, SamplingFilter::Lanczos3)
        }
        MapOperation::Crop { x, y, width, height } => {
            transform::crop(&mut img, x, y, x + width, y + height)
        }
    };

    let out = assets_dir.join(output_name(source_path, "map"));
    save_png(img, &out)?;
    Ok(out.to_string_lossy().into_owned())
}

// ---------------------------------------------------------------------------
// Image I/O
// ---------------------------------------------------------------------------

fn load_image(path: &str) -> Result<PhotonImage, String> {
    // Use the image crate for reliable loading, then wrap in PhotonImage
    let rgba = image::open(path)
        .map_err(|e| format!("Cannot open image: {e}"))?
        .to_rgba8();
    let (w, h) = (rgba.width(), rgba.height());
    Ok(PhotonImage::new(rgba.into_raw(), w, h))
}

fn save_png(img: PhotonImage, path: &Path) -> Result<(), String> {
    let w = img.get_width();
    let h = img.get_height();
    let raw = img.get_raw_pixels();
    image::ImageBuffer::<image::Rgba<u8>, Vec<u8>>::from_raw(w, h, raw)
        .ok_or_else(|| "Failed to construct image buffer".to_string())?
        .save(path)
        .map_err(|e| format!("Cannot save PNG: {e}"))
}

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

fn square_crop_centre(mut img: PhotonImage) -> PhotonImage {
    let w = img.get_width();
    let h = img.get_height();
    if w == h {
        return img;
    }
    let size = w.min(h);
    let x = (w - size) / 2;
    let y = (h - size) / 2;
    transform::crop(&mut img, x, y, x + size, y + size)
}

fn apply_circle_mask(img: PhotonImage) -> PhotonImage {
    let w = img.get_width();
    let h = img.get_height();
    let cx = w as f32 / 2.0;
    let cy = h as f32 / 2.0;
    let r_sq = cx.min(cy).powi(2);

    let mut raw = img.get_raw_pixels();
    for y in 0..h {
        for x in 0..w {
            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            if dx * dx + dy * dy > r_sq {
                let i = ((y * w + x) * 4) as usize;
                raw[i + 3] = 0;
            }
        }
    }
    PhotonImage::new(raw, w, h)
}

fn apply_rounded_corners(img: PhotonImage, radius_frac: f32) -> PhotonImage {
    let w = img.get_width();
    let h = img.get_height();
    let r = (w.min(h) as f32 * radius_frac).round() as u32;
    let r_sq = (r as f32).powi(2);

    let mut raw = img.get_raw_pixels();

    // (corner_top_left_x, corner_top_left_y, arc_centre_x, arc_centre_y)
    let corners: [(u32, u32, f32, f32); 4] = [
        (0,     0,     r as f32,           r as f32),
        (w - r, 0,     (w - r) as f32,     r as f32),
        (0,     h - r, r as f32,           (h - r) as f32),
        (w - r, h - r, (w - r) as f32,     (h - r) as f32),
    ];

    for (bx, by, cx, cy) in corners {
        for dy in 0..r {
            for dx in 0..r {
                let px = bx + dx;
                let py = by + dy;
                if px < w && py < h {
                    let ddx = px as f32 - cx;
                    let ddy = py as f32 - cy;
                    if ddx * ddx + ddy * ddy > r_sq {
                        let i = ((py * w + px) * 4) as usize;
                        if i + 3 < raw.len() {
                            raw[i + 3] = 0;
                        }
                    }
                }
            }
        }
    }

    PhotonImage::new(raw, w, h)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn ensure_assets_dir(data_dir: &Path) -> Result<PathBuf, String> {
    let dir = data_dir.join("vtt-assets");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create assets dir: {e}"))?;
    Ok(dir)
}

fn output_name(source_path: &str, suffix: &str) -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let stem = Path::new(source_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    format!("{ts}_{stem}_{suffix}.png")
}
