const AppInfoParser = require('app-info-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Ditambahkan untuk hashing SHA-256

const apkDir = path.join(process.cwd(), 'APK');
const iconDir = path.join(apkDir, 'icons');
const catalogPath = path.join(apkDir, 'apps.json');

// Pastikan folder icons tersedia
if (!fs.existsSync(iconDir)){
    fs.mkdirSync(iconDir, { recursive: true });
}

// Fungsi helper untuk menghitung SHA-256 secara efisien (Stream) untuk file besar
function getFileSha256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

function extname(filename) {
    return path.parse(filename).ext.toLowerCase();
}

async function processAllApks() {
    console.log("📁 Scanning APK directory...");
    
    if (!fs.existsSync(apkDir)) {
        console.error("❌ Directory 'APK' not found! Please create it and put your .apk files inside.");
        return;
    }

    const files = fs.readdirSync(apkDir);
    const apkFiles = files.filter(file => extname(file) === '.apk');

    console.log(`Found ${apkFiles.length} APK file(s) to process.`);
    const appCatalog = [];

    for (const file of apkFiles) {
        const apkPath = path.join(apkDir, file);
        const fileNameWithoutExt = path.parse(file).name;
        console.log(`\n🔍 Parsing: ${file}...`);

        try {
            const parser = new AppInfoParser(apkPath);
            const result = await parser.parse();
            
            // 1. Dapatkan stat file untuk Size & Update Date asli
            const stats = fs.statSync(apkPath);
            
            // 2. Kalkulasi SHA-256
            const sha256Hash = await getFileSha256(apkPath);

            // Parsing Metadata
            // app-info-parser biasanya menaruh nama APK di result.application.label
            const appName = result.application?.label || result.w3cManifest?.name || result.label || fileNameWithoutExt;
            const version = result.versionName || "1.0.0";
            const minSdk = result.usesSdk?.minSdkVersion || "";
            
            // Menggunakan tanggal modifikasi file (mtime) BUKAN tanggal hari ini
            const updateDate = stats.mtime.toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            });

            // Handle Icon
            let iconRelativePath = "";
            if (result.icon) {
                // Regex disesuaikan agar bisa menangani png/jpeg
                const base64Data = result.icon.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
                const iconFileName = `${fileNameWithoutExt}.png`;
                fs.writeFileSync(path.join(iconDir, iconFileName), base64Data, 'base64');
                iconRelativePath = `APK/icons/${iconFileName}`;
            }

            // Push metadata ke array catalog
            appCatalog.push({
                file_name: file,
                app_name: appName,
                version: version,
                package_name: result.package || "unknown.package",
                update_date: updateDate,
                icon_path: iconRelativePath,
                download_path: `APK/${file}`,
                size_mb: (stats.size / (1024 * 1024)).toFixed(2),
                
                // --- PROPERTI TAMBAHAN UNTUK LANDING PAGE ---
                sha256: sha256Hash,
                min_sdk: minSdk,
                category: "Enterprise" // Berikan default kategori agar Filter Tabs di LP bekerja
            });

            console.log(`✅ Success processing ${appName}`);
        } catch (err) {
            console.error(`❌ Failed to parse ${file}:`, err.message);
        }
    }

    // Tulis semua data ke apps.json
    fs.writeFileSync(catalogPath, JSON.stringify(appCatalog, null, 2));
    console.log("\n🚀 Global apps.json catalog has been updated!");
}

processAllApks();
