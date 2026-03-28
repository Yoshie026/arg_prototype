import SwiftUI

@main
struct WatchRecorderApp: App {
    @StateObject private var audioManager = AudioManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(audioManager)
        }
    }
}
