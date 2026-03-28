import SwiftUI

struct ContentView: View {
    @EnvironmentObject var audioManager: AudioManager
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            RecordView()
                .tag(0)

            ClipsView()
                .tag(1)
        }
        .tabViewStyle(.page)
    }
}
