// swift-tools-version: 5.9
import PackageDescription

// The package and product names must be the PascalCase of the npm name, "forge-folder-backup",
// because that is the name `cap sync` writes into ios/App/CapApp-SPM/Package.swift.
let package = Package(
    name: "ForgeFolderBackup",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ForgeFolderBackup",
            targets: ["FolderBackupPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "FolderBackupPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/FolderBackupPlugin")
    ]
)
