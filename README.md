# Enterprise App Center – PWA & APK Distribution Hub

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-success?style=flat-square\&logo=github)](https://anggaconni.github.io/Download/)
[![Node.js](https://img.shields.io/badge/Node.js-v20-blue?style=flat-square\&logo=node.js)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-orange?style=flat-square\&logo=githubactions)](https://github.com/features/actions)

## Overview

Enterprise App Center is a serverless Progressive Web Application (PWA) designed to manage, catalog, and distribute Android application packages (`.apk`) through an automated CI/CD pipeline.

This repository showcases my experience in:

* Progressive Web Application (PWA) development
* CI/CD automation using GitHub Actions
* APK metadata extraction and asset processing
* Serverless deployment architecture using GitHub Pages

By simply uploading APK files into the repository, the platform automatically extracts application metadata, generates a centralized catalog, and publishes the updated application dashboard without requiring any traditional backend server.

---

## 🚀 Key Features

### Automated Asset Extraction Pipeline

Upload raw `.apk` files into the `APK/` directory and the pipeline automatically extracts:

* Application name
* Version information
* Package name
* Original application icon

No manual processing is required.

### Single Source of Truth (JSON Catalog)

Every deployment rebuilds the centralized `apps.json` catalog, ensuring all application metadata remains synchronized and up to date.

### Modern Dashboard Interface

A lightweight and responsive dashboard built using:

* HTML5
* Vanilla JavaScript (ES6+)
* Tailwind CSS

Designed with a clean, enterprise-style user experience.

### Real-Time Search & Filtering

Instantly search applications by:

* Application Name
* Version
* Package Name

Scales efficiently from a few applications to large internal catalogs.

### Smart Fallback & Dynamic Routing

The platform automatically:

* Displays interactive empty states when no applications exist
* Generates dynamic avatars using UI-Avatars when application icons are unavailable

### Zero Infrastructure Cost

Fully hosted on GitHub Pages with:

* Serverless deployment
* Automated CI/CD
* No database server
* No backend hosting costs

### Social & Portfolio Ready

Includes optimized:

* Open Graph metadata
* Twitter Cards
* SVG Data URI favicon

Ensuring consistent previews across social and professional platforms.

---

## 📂 Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions CI/CD workflow
│
├── APK/
│   ├── apps.json            # Auto-generated application catalog
│   └── icons/               # Auto-extracted application icons
│
├── index.html               # Main dashboard UI
├── extract.js               # APK metadata extraction engine
└── README.md                # Project documentation
```

---

## ⚙️ System Workflow

### 1. APK Upload

Developers upload or update `.apk` files inside the `APK/` directory.

### 2. CI/CD Trigger

GitHub Actions automatically detects repository changes and launches a fresh execution environment.

### 3. Metadata Extraction

Node.js executes `extract.js`, parsing the Android package and extracting:

* Application name
* Version
* Package identifier
* Application icon

### 4. Catalog Synchronization

The extracted metadata is consolidated into `apps.json`, while application icons are exported as physical `.png` assets.

### 5. Automatic Deployment

GitHub Actions commits the generated assets and metadata back into the repository, triggering GitHub Pages to publish the latest catalog automatically.

---

## 🛠 Technology Stack

### Frontend

* HTML5
* Vanilla JavaScript (ES6+)
* Tailwind CSS

### Automation Engine

* Node.js v20
* app-info-parser

### CI/CD

* GitHub Actions

### Hosting

* GitHub Pages

### Architecture

* Serverless Deployment
* Static Asset Distribution
* Automated Metadata Processing

---

## 🎯 Use Cases

This platform is suitable for:

* Internal enterprise APK distribution
* QA and testing environments
* Mobile application staging repositories
* Educational demonstrations of CI/CD automation
* Serverless software distribution portals
* PWA portfolio projects

---

## License

This repository is provided for educational, demonstration, and portfolio purposes.
