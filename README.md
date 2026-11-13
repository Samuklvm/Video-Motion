# Video Motion

**Video Motion** is a Windows-first desktop video editor project inspired by the timeline workflow of CapCut and the animation/effect controls documented in the Alight Motion recovery archive. This repository is the start of a new editor; it is not yet a complete or feature-equivalent replacement.

## Current foundation

- A project library opens before the editor, with create, search, open, rename, delete and import entry points.
- The editor shell is organized around a preview, multi-track timeline, transport controls, an effects browser, and an inspector with keyframe controls.
- Projects use the open JSON-based `.vmproj` format and are stored locally under the user's Video Motion app-data folder.
- Alight Motion XML/`.amproj` import is designed as a compatibility path. Unsupported fields and effects are preserved in the project instead of being silently discarded; full rendering parity is not implemented yet.
- Windows releases are designed to use NSIS and GitHub Releases for in-app update checks.

## Run from source

Requirements: Node.js 24 or later and npm.

```powershell
npm install
npm run dev
```

## Build and release

```powershell
npm run build
npm run dist:win
```

To publish an update, push a semantic version tag such as `v0.2.0`. The GitHub Actions release workflow builds a Windows installer and publishes the update metadata and installer to a GitHub Release. Users can check for updates in Video Motion. A signed Windows installer/certificate is recommended before public distribution to reduce SmartScreen warnings.

## Compatibility status

The original package recovery contains declarative effect XML, preview images, scene examples, UI resources, and Smali bytecode. These are useful format and behavior references, but they do not provide an original Windows renderer or guarantee that mobile effects can run unchanged on desktop. Import and rendering coverage will be tracked explicitly as it is implemented.

See [ROADMAP.md](ROADMAP.md) for the current feature status and the remaining work toward a fuller editor.

## License

The Video Motion application code in this repository is licensed under Apache-2.0. Imported projects and media remain the user's property. Do not assume third-party APK assets, artwork, fonts, or effect code are relicensed by this repository.
