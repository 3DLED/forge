import Foundation
import Capacitor
import UIKit
import UniformTypeIdentifiers

/// Keeps one backup file in a folder the person chose, wherever that folder lives.
///
/// The Files app is the one place iCloud Drive, Google Drive and OneDrive all show up, because
/// each ships a File Provider. So instead of signing in to three services, the app asks once
/// for a folder through the standard picker and keeps a bookmark to it. Every later save goes
/// straight into that folder, overwriting the same file, with no account, no network code in
/// this app, and nothing for anyone to maintain when a cloud API changes.
///
/// The bookmark is the whole trick. A URL from the picker only stays usable while the app is
/// running; a bookmark made from it can be resolved again next week, after a relaunch, and
/// grants the same access as the original pick.
///
/// Nothing here has run on a device yet. Whether every provider honours a bookmarked write is
/// up to the provider: iCloud Drive does, and the others are the thing to test first.
@objc(FolderBackupPlugin)
public class FolderBackupPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "FolderBackupPlugin"
    public let jsName = "FolderBackup"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forget", returnType: CAPPluginReturnPromise)
    ]

    private static let bookmarkKey = "forge.backupFolderBookmark"

    /// The pick in progress. The picker answers through the delegate, not the call.
    private var pickCall: CAPPluginCall?

    // MARK: choosing the folder

    @objc func pickFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("There is no screen to show the folder picker on.")
                return
            }
            // A second tap while the first picker is still open answers the first as cancelled
            // rather than leaving its promise hanging for ever.
            self.pickCall?.resolve(["cancelled": true])
            self.pickCall = call

            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.folder], asCopy: false)
            picker.delegate = self
            picker.allowsMultipleSelection = false
            presenter.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickCall else { return }
        pickCall = nil

        guard let url = urls.first else {
            call.resolve(["cancelled": true])
            return
        }

        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        do {
            let bookmark = try url.bookmarkData(
                options: .minimalBookmark,
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
            UserDefaults.standard.set(bookmark, forKey: Self.bookmarkKey)
            call.resolve(["cancelled": false, "folder": url.lastPathComponent])
        } catch {
            call.reject("Could not keep hold of that folder: \(error.localizedDescription)")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickCall?.resolve(["cancelled": true])
        pickCall = nil
    }

    // MARK: the folder, later

    /// The chosen folder, or nil when none has been chosen.
    ///
    /// A stale bookmark still resolves; it just needs making again while access is open, or
    /// it eventually stops resolving at all. Refreshed quietly, because there is nothing the
    /// person could do about it.
    private func resolveFolder() throws -> URL? {
        guard let data = UserDefaults.standard.data(forKey: Self.bookmarkKey) else { return nil }

        var stale = false
        let url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)

        if stale {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            if let fresh = try? url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil) {
                UserDefaults.standard.set(fresh, forKey: Self.bookmarkKey)
            }
        }
        return url
    }

    @objc func status(_ call: CAPPluginCall) {
        do {
            guard let url = try resolveFolder() else {
                call.resolve(["folder": NSNull()])
                return
            }
            call.resolve(["folder": url.lastPathComponent])
        } catch {
            call.resolve(["folder": NSNull(), "error": error.localizedDescription])
        }
    }

    // MARK: saving

    @objc func write(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename"), !filename.isEmpty,
              let text = call.getString("data") else {
            call.reject("A filename and the data to write are both required.")
            return
        }

        // A name, never a path. Whatever arrives, the file lands inside the chosen folder.
        let name = (filename as NSString).lastPathComponent

        DispatchQueue.global(qos: .utility).async {
            do {
                guard let folder = try self.resolveFolder() else {
                    call.reject("No backup folder has been chosen.", "NO_FOLDER")
                    return
                }

                let scoped = folder.startAccessingSecurityScopedResource()
                defer { if scoped { folder.stopAccessingSecurityScopedResource() } }

                let target = folder.appendingPathComponent(name)
                let bytes = Data(text.utf8)

                // Coordinated, because the folder may belong to a sync provider that is reading or
                // uploading the previous copy at the same moment.
                var coordinationError: NSError?
                var writeError: Error?
                NSFileCoordinator(filePresenter: nil).coordinate(
                    writingItemAt: target,
                    options: .forReplacing,
                    error: &coordinationError
                ) { url in
                    do {
                        try bytes.write(to: url, options: .atomic)
                    } catch {
                        // Some providers refuse the rename an atomic write finishes with.
                        do {
                            try bytes.write(to: url)
                        } catch {
                            writeError = error
                        }
                    }
                }

                if let failure = (coordinationError as Error?) ?? writeError {
                    call.reject("Could not write the backup: \(failure.localizedDescription)", "WRITE_FAILED")
                    return
                }
                call.resolve(["folder": folder.lastPathComponent, "bytes": bytes.count])
            } catch {
                call.reject("The backup folder can no longer be reached: \(error.localizedDescription)", "FOLDER_GONE")
            }
        }
    }

    @objc func forget(_ call: CAPPluginCall) {
        UserDefaults.standard.removeObject(forKey: Self.bookmarkKey)
        call.resolve()
    }
}
