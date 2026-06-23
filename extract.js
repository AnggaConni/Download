const AppInfoParser = require('app-info-parser');
const fs = require('fs');
const path = require('path');

const apkDir = path.join(process.cwd(), 'APK');
const iconDir = path.join(apkDir, 'icons');
const catalogPath = path.join(apkDir, 'apps.json');

// Pastikan folder icons tersedia
if (!fs.existsSync(iconDir)){
    fs.mkdirSync(iconDir, { recursive: true });
}

async function processAllApks() {
    console.log("📁 Scanning APK directory...");
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

            const appName = result.w3cManifest?.name || result.label || fileNameWithoutExt;
            const version = result.versionName || "1.0.0";
            const updateDate = new Date().toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            });

            // Handle Icon
            const iconRelativePath = `APK/icons/${fileNameWithoutExt}.png`;
            if (result.icon) {
                const base64Data = result.icon.replace(/^data:image\/png;base64,/, "");
                fs.writeFileSync(path.join(iconDir, `${fileNameWithoutExt}.png`), base64Data, 'base64');
            }

            // Push metadata ke array catalog
            appCatalog.push({
                file_name: file,
                app_name: appName,
                version: version,
                package_name: result.package,
                update_date: updateDate,
                icon_path: iconRelativePath,
                download_path: `APK/${file}`,
                size_mb: (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2)
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

function extname(filename) {
    return path.parse(filename).ext.toLowerCase();
}

processAllApks();
