const AppInfoParser = require('app-info-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const apkDir = path.join(process.cwd(), 'APK');
const iconDir = path.join(apkDir, 'icons');
const catalogPath = path.join(apkDir, 'apps.json');

if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
}

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
        console.log(`\n🔍 Parsing: ${file}...`);

        try {
            const parser = new AppInfoParser(apkPath);
            const result = await parser.parse();
            const stats = fs.statSync(apkPath);
            const sha256Hash = await getFileSha256(apkPath);

            const appName = result.application?.label || result.w3cManifest?.name || result.label || fileNameWithoutExt;
            const version = result.versionName || "1.0.0";
            const minSdk = result.usesSdk?.minSdkVersion || "";
            const pkgName = result.package || "unknown.package";
            
            // Baca Release Notes (Mencari file .txt atau .md dengan nama yg sama dgn apk)
            let releaseNotes = "";
            const txtPath = path.join(apkDir, `${fileNameWithoutExt}.txt`);
            const mdPath = path.join(apkDir, `${fileNameWithoutExt}.md`);
            
            if (fs.existsSync(txtPath)) {
                releaseNotes = fs.readFileSync(txtPath, 'utf-8');
            } else if (fs.existsSync(mdPath)) {
                releaseNotes = fs.readFileSync(mdPath, 'utf-8');
            }

            let iconRelativePath = "";
            if (result.icon) {
                const base64Data = result.icon.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
                const iconFileName = `${pkgName}_${version}.png`; // Nama unik per versi
                fs.writeFileSync(path.join(iconDir, iconFileName), base64Data, 'base64');
                iconRelativePath = `APK/icons/${iconFileName}`;
            }

            parsedApks.push({
                package_name: pkgName,
                app_name: appName,
                version: version,
                file_name: file,
                download_path: `APK/${file}`,
                size_mb: (stats.size / (1024 * 1024)).toFixed(2),
                update_date_str: stats.mtime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                timestamp: stats.mtime.getTime(), // Untuk sorting akurat
                sha256: sha256Hash,
                min_sdk: minSdk,
                icon_path: iconRelativePath,
                release_notes: releaseNotes
            });

            console.log(`✅ Success processing ${appName} (v${version})`);
        } catch (err) {
            console.error(`❌ Failed to parse ${file}:`, err.message);
        }
    }

    // 2. Grouping & Sorting berdasarkan Package Name
    const groupedApps = {};
    parsedApks.forEach(apk => {
        if (!groupedApps[apk.package_name]) {
            groupedApps[apk.package_name] = [];
        }
        groupedApps[apk.package_name].push(apk);
    });

    const finalCatalog = [];
    
    // Format JSON baru sesuai kebutuhan Landing Page
    for (const pkg in groupedApps) {
        // Sort versi dari yang terbaru ke terlama berdasarkan timestamp mtime
        const versions = groupedApps[pkg].sort((a, b) => b.timestamp - a.timestamp);
        const latest = versions[0]; // Versi paling atas adalah yang terbaru

        finalCatalog.push({
            app_name: latest.app_name,
            package_name: pkg,
            category: "Enterprise", 
            icon_path: latest.icon_path,
            latest_version: latest.version,
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
