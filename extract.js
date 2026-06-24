const AppInfoParser = require('app-info-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Built-in Node.js untuk hashing

const apkDir = path.join(process.cwd(), 'APK');
const iconDir = path.join(apkDir, 'icons');
const catalogPath = path.join(apkDir, 'apps.json');

// Pastikan folder tersedia
if (!fs.existsSync(iconDir)){
    fs.mkdirSync(iconDir, { recursive: true });
}

// Fungsi untuk menghitung SHA-256 dari file APK
function calculateSHA256(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

async function processAllApks() {
    console.log("📁 Scanning APK directory...");
    const files = fs.readdirSync(apkDir);
    const apkFiles = files.filter(file => path.extname(file).toLowerCase() === '.apk');

    console.log(`Found ${apkFiles.length} APK file(s) to process.`);
    
    // BACA JSON LAMA (Agar tidak menimpa data manual seperti "category")
    let existingCatalog = [];
    if (fs.existsSync(catalogPath)) {
        try {
            existingCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        } catch (e) {
            console.log("⚠️ Failed to read existing apps.json, starting fresh.");
        }
    }

    const appCatalog = [];

    for (const file of apkFiles) {
        const apkPath = path.join(apkDir, file);
        const fileNameWithoutExt = path.parse(file).name;
        console.log(`\n🔍 Parsing: ${file}...`);

        try {
            // Ambil statistik file (untuk ukuran dan TANGGAL ASLI file)
            const fileStats = fs.statSync(apkPath);
            const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
            const updateDate = new Date(fileStats.mtime).toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            });

            // Hitung Keamanan Hash (Untuk verifikasi Cryptographically UI)
            const fileHash = calculateSHA256(apkPath);

            // Cek apakah APK ini sudah ada di JSON lama & tidak berubah (Berdasarkan Hash)
            const existingApp = existingCatalog.find(app => app.file_name === file);
            let category = "App"; // Default Kategori

            // Jika ada di database lama, pertahankan kategorinya agar ketikan manual tidak hilang
            if (existingApp && existingApp.category) {
                category = existingApp.category;
            }

            const parser = new AppInfoParser(apkPath);
            const result = await parser.parse();

            const appName = result.w3cManifest?.name || result.label || fileNameWithoutExt;
            const version = result.versionName || "1.0.0";
            
            // Ekstrak Minimum SDK
            const minSdk = result.usesSdk?.minSdkVersion || "";

            // Handle Icon
            let iconRelativePath = "";
            if (result.icon) {
                iconRelativePath = `APK/icons/${fileNameWithoutExt}.png`;
                const base64Data = result.icon.replace(/^data:image\/png;base64,/, "");
                fs.writeFileSync(path.join(iconDir, `${fileNameWithoutExt}.png`), base64Data, 'base64');
            } else if (existingApp && existingApp.icon_path) {
                iconRelativePath = existingApp.icon_path;
            }

            // Push metadata ke array catalog
            appCatalog.push({
                file_name: file,
                app_name: appName,
                version: version,
                package_name: result.package,
                update_date: updateDate,     // TANGGAL ASLI MODIFIKASI FILE
                min_sdk: minSdk,             // MIN SDK UNTUK UI
                sha256: fileHash,            // HASH UNTUK UI
                category: category,          // KATEGORI UNTUK FILTER TAB UI
                icon_path: iconRelativePath,
                download_path: `APK/${file}`,
                size_mb: fileSizeMB
            });

            console.log(`✅ Success processing ${appName} (v${version})`);
        } catch (err) {
            console.error(`❌ Failed to parse ${file}:`, err.message);
        }
    }
