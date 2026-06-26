const AppInfoParser = require('app-info-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const apkDir = path.join(process.cwd(), 'APK');
const iconDir = path.join(apkDir, 'icons');
const catalogPath = path.join(apkDir, 'apps.json');

// Buat folder icons jika belum ada
if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
}

// Fungsi untuk mendapatkan hash SHA-256
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
        console.error("❌ Directory 'APK' not found!");
        return;
    }

    const files = fs.readdirSync(apkDir);
    const apkFiles = files.filter(file => extname(file) === '.apk');

    console.log(`Found ${apkFiles.length} APK file(s) to process.`);
    const parsedApks = [];

    // 1. Parsing semua APK
    for (const file of apkFiles) {
        const apkPath = path.join(apkDir, file);
        const fileNameWithoutExt = path.parse(file).name;
        console.log(`\n🔍 Processing: ${file}...`);

        try {
            const stats = fs.statSync(apkPath);
            const sha256Hash = await getFileSha256(apkPath);

            // Baca Release Notes
            let releaseNotes = "";
            const txtPath = path.join(apkDir, `${fileNameWithoutExt}.txt`);
            const mdPath = path.join(apkDir, `${fileNameWithoutExt}.md`);
            
            if (fs.existsSync(txtPath)) {
                releaseNotes = fs.readFileSync(txtPath, 'utf-8');
            } else if (fs.existsSync(mdPath)) {
                releaseNotes = fs.readFileSync(mdPath, 'utf-8');
            }

            // Default Data (Fallback jika parsing gagal)
            let appData = {
                package_name: `unknown.package.${fileNameWithoutExt.toLowerCase()}`,
                app_name: fileNameWithoutExt,
                version: "1.0.0",
                file_name: file,
                download_path: `APK/${file}`,
                size_mb: (stats.size / (1024 * 1024)).toFixed(2),
                update_date_str: stats.mtime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                timestamp: stats.mtime.getTime(),
                sha256: sha256Hash,
                min_sdk: "",
                icon_path: "",
                release_notes: releaseNotes
            };

            // Mencoba melakukan parsing isi APK
            try {
                const parser = new AppInfoParser(apkPath);
                const result = await parser.parse();

                // Timpa data default dengan data hasil parsing jika berhasil
                appData.app_name = result.application?.label || result.w3cManifest?.name || result.label || fileNameWithoutExt;
                appData.version = result.versionName || "1.0.0";
                appData.min_sdk = result.usesSdk?.minSdkVersion || "";
                appData.package_name = result.package || appData.package_name;
                
                // Ekstrak Ikon
                if (result.icon) {
                    const base64Data = result.icon.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
                    // Tambahkan timestamp untuk menghindari cache gambar di browser
                    const iconFileName = `${appData.package_name}_${appData.version}_${Date.now()}.png`; 
                    fs.writeFileSync(path.join(iconDir, iconFileName), base64Data, 'base64');
                    appData.icon_path = `APK/icons/${iconFileName}`;
                }
                
                console.log(`✅ Success parsing metadata for ${appData.app_name} (v${appData.version})`);
            } catch (parseErr) {
                console.log(`⚠️ Failed to parse deep metadata for ${file}, using default fallback data. (${parseErr.message})`);
            }

            parsedApks.push(appData);

        } catch (err) {
            console.error(`❌ Critical error processing ${file}:`, err.message);
        }
    }

    // 2. Grouping & Sorting
    const groupedApps = {};
    parsedApks.forEach(apk => {
        // MENGGUNAKAN COMPOSITE KEY: package_name + app_name
        // Ini mencegah bug di mana 2 APK berbeda punya package name yang sama
        const groupKey = `${apk.package_name}_${apk.app_name}`;
        
        if (!groupedApps[groupKey]) {
            groupedApps[groupKey] = [];
        }
        groupedApps[groupKey].push(apk);
    });

    const finalCatalog = [];
    
    // Format JSON baru sesuai kebutuhan Landing Page
    for (const groupKey in groupedApps) {
        // Sort versi dari yang terbaru ke terlama berdasarkan timestamp mtime
        const versions = groupedApps[groupKey].sort((a, b) => b.timestamp - a.timestamp);
        const latest = versions[0]; // Versi paling atas adalah yang terbaru

        finalCatalog.push({
            app_name: latest.app_name,
            package_name: latest.package_name,
            category: "Enterprise", 
            icon_path: latest.icon_path,
            
            // --- TAMBAHKAN BARIS INI AGAR HTML TERBACA ---
            version: latest.version,
            download_path: latest.download_path,
            size_mb: latest.size_mb,
            sha256: latest.sha256,
            min_sdk: latest.min_sdk,
            // ---------------------------------------------
            
            update_date: latest.update_date_str,
            timestamp: latest.timestamp,
            total_versions: versions.length,
            versions: versions.map(v => ({
                version: v.version,
                file_name: v.file_name,
                download_path: v.download_path,
                size_mb: v.size_mb,
                update_date: v.update_date_str,
                sha256: v.sha256,
                min_sdk: v.min_sdk,
                release_notes: v.release_notes
            }))
        });
    }

    // Sort global catalog berdasarkan update paling baru
    finalCatalog.sort((a, b) => b.timestamp - a.timestamp);

    fs.writeFileSync(catalogPath, JSON.stringify(finalCatalog, null, 2));
    console.log(`\n🚀 Global apps.json updated! Grouped into ${finalCatalog.length} Apps.`);
}

processAllApks();
