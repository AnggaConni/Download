const AppInfoParser = require('app-info-parser');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const apkDir = path.join(process.cwd(), 'APK');
const iconDir = path.join(apkDir, 'icons');
const screenshotsDir = path.join(apkDir, 'screenshots'); 
const catalogPath = path.join(apkDir, 'apps.json');

// Buat folder jika belum ada
if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

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

// Fungsi pembantu untuk menormalisasi path ZIP (selalu gunakan forward slash)
function normalizeZipPath(p) {
    return p.replace(/\\/g, '/');
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

    for (const file of apkFiles) {
        const apkPath = path.join(apkDir, file);
        const fileNameWithoutExt = path.parse(file).name;
        console.log(`\n🔍 Processing: ${file}...`);

        try {
            const stats = fs.statSync(apkPath);
            const sha256Hash = await getFileSha256(apkPath);

            // Baca Release Notes (Opsional - dari file .txt/.md)
            let releaseNotes = "";
            const txtPath = path.join(apkDir, `${fileNameWithoutExt}.txt`);
            const mdPath = path.join(apkDir, `${fileNameWithoutExt}.md`);
            
            if (fs.existsSync(txtPath)) releaseNotes = fs.readFileSync(txtPath, 'utf-8');
            else if (fs.existsSync(mdPath)) releaseNotes = fs.readFileSync(mdPath, 'utf-8');

            // Default Data
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
                release_notes: releaseNotes,
                description: "Tidak ada deskripsi tersedia untuk aplikasi ini.",
                screenshots: []
            };

            // LANGKAH A: Ekstrak Data Android Native (Ikon & Package Name)
            try {
                const parser = new AppInfoParser(apkPath);
                const result = await parser.parse();

                appData.app_name = result.application?.label || result.w3cManifest?.name || result.label || fileNameWithoutExt;
                appData.version = result.versionName || "1.0.0";
                appData.min_sdk = result.usesSdk?.minSdkVersion || "";
                appData.package_name = result.package || appData.package_name;
                
                if (result.icon) {
                    const base64Data = result.icon.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
                    const iconFileName = `${appData.package_name}_${appData.version}_${Date.now()}.png`; 
                    fs.writeFileSync(path.join(iconDir, iconFileName), base64Data, 'base64');
                    appData.icon_path = `APK/icons/${iconFileName}`;
                }
                console.log(`  └─ Android Metadata: Success`);
            } catch (parseErr) {
                console.log(`  └─ Android Metadata fallback applied: ${parseErr.message}`);
            }

            // LANGKAH B: Ekstrak manifest.json PWA & Screenshots dari ZIP APK
            try {
                const zip = new AdmZip(apkPath);
                const zipEntries = zip.getEntries();
                
                // Cari manifest.json atau .webmanifest
                const manifestEntry = zipEntries.find(entry => 
                    (entry.entryName.endsWith('manifest.json') || entry.entryName.endsWith('.webmanifest')) && !entry.isDirectory
                );

                if (manifestEntry) {
                    console.log(`  └─ Found PWA manifest inside APK at: ${manifestEntry.entryName}`);
                    const manifestContent = manifestEntry.getData().toString('utf8');
                    const manifestJson = JSON.parse(manifestContent);

                    // 1. Ekstrak Deskripsi
                    if (manifestJson.description) {
                        appData.description = manifestJson.description;
                    } else if (manifestJson.short_name) {
                        appData.description = `${manifestJson.name || appData.app_name} - ${manifestJson.short_name}`;
                    }

                    // 2. Ekstrak Screenshots
                    if (manifestJson.screenshots && Array.isArray(manifestJson.screenshots)) {
                        console.log(`  └─ PWA Manifest has ${manifestJson.screenshots.length} screenshots. Extracting...`);
                        
                        const appScreensDir = path.join(screenshotsDir, appData.package_name);
                        if (!fs.existsSync(appScreensDir)) fs.mkdirSync(appScreensDir, { recursive: true });

                        const manifestBaseDir = path.dirname(manifestEntry.entryName);

                        manifestJson.screenshots.forEach((screen, index) => {
                            if (screen.src) {
                                // Path di dalam ZIP
                                const rawPathInZip = normalizeZipPath(path.join(manifestBaseDir, screen.src));
                                const screenEntry = zipEntries.find(entry => entry.entryName === rawPathInZip);

                                if (screenEntry) {
                                    const ext = extname(screen.src) || '.png';
                                    const screenFileName = `screen_${appData.version}_${index + 1}${ext}`;
                                    const outputPath = path.join(appScreensDir, screenFileName);

                                    // Simpan gambar fisik
                                    fs.writeFileSync(outputPath, screenEntry.getData());
                                    
                                    // Tambahkan ke JSON Data
                                    appData.screenshots.push(`APK/screenshots/${appData.package_name}/${screenFileName}`);
                                }
                            }
                        });
                    }
                } else {
                    console.log(`  └─ No PWA manifest.json found in this APK assets.`);
                }
            } catch (zipErr) {
                console.log(`  └─ Failed to scan ZIP / manifest: ${zipErr.message}`);
            }

            parsedApks.push(appData);

        } catch (err) {
            console.error(`❌ Critical error processing ${file}:`, err.message);
        }
    }

    // 2. Grouping berdasarkan package_name (Mengelompokkan versi lama dan baru)
    const groupedApps = {};
    parsedApks.forEach(apk => {
        const groupKey = `${apk.package_name}_${apk.app_name}`;
        if (!groupedApps[groupKey]) groupedApps[groupKey] = [];
        groupedApps[groupKey].push(apk);
    });

    const finalCatalog = [];
    
    // 3. Format JSON
    for (const groupKey in groupedApps) {
        // Urutkan dari versi terbaru (berdasarkan tanggal file)
        const versions = groupedApps[groupKey].sort((a, b) => b.timestamp - a.timestamp);
        const latest = versions[0]; 

        finalCatalog.push({
            app_name: latest.app_name,
            package_name: latest.package_name,
            category: "PWA Application", 
            icon_path: latest.icon_path,
            description: latest.description,
            screenshots: latest.screenshots,
            version: latest.version,
            download_path: latest.download_path,
            size_mb: latest.size_mb,
            sha256: latest.sha256,
            min_sdk: latest.min_sdk,
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
                release_notes: v.release_notes,
                screenshots: v.screenshots // Tiap versi punya history screenshotnya sendiri
            }))
        });
    }

    // Urutkan katalog berdasarkan aplikasi yang paling baru di-update
    finalCatalog.sort((a, b) => b.timestamp - a.timestamp);

    fs.writeFileSync(catalogPath, JSON.stringify(finalCatalog, null, 2));
    console.log(`\n🚀 Global apps.json updated! Total Apps: ${finalCatalog.length}`);
}

processAllApks();
