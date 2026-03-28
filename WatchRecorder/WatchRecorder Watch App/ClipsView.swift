import SwiftUI

struct ClipsView: View {
    @EnvironmentObject var audioManager: AudioManager

    var body: some View {
        Group {
            if audioManager.clips.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "waveform")
                        .font(.system(size: 28))
                        .foregroundStyle(.secondary)
                    Text("No recordings yet")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                    Text("Swipe left to record")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
            } else {
                List {
                    ForEach(audioManager.clips) { clip in
                        ClipRow(clip: clip)
                    }
                    .onDelete { indexSet in
                        for i in indexSet {
                            audioManager.deleteClip(audioManager.clips[i])
                        }
                    }
                }
                .listStyle(.carousel)
            }
        }
        .navigationTitle("Clips")
    }
}

struct ClipRow: View {
    @EnvironmentObject var audioManager: AudioManager
    let clip: AudioClip

    private var isPlaying: Bool { audioManager.currentlyPlayingID == clip.id }

    var body: some View {
        Button(action: { audioManager.togglePlayback(clip: clip) }) {
            HStack(spacing: 10) {
                // Play/Pause icon
                ZStack {
                    Circle()
                        .fill(isPlaying ? Color.primary : Color.clear)
                        .frame(width: 30, height: 30)
                        .overlay(
                            Circle().stroke(Color.secondary.opacity(0.4), lineWidth: 1)
                        )

                    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(isPlaying ? Color.black : .primary)
                        .offset(x: isPlaying ? 0 : 1)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(clip.displayName)
                        .font(.system(size: 13, weight: .medium))
                        .lineLimit(1)

                    Text(clip.displayDuration)
                        .font(.system(size: 11).monospacedDigit())
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding(.vertical, 2)
        }
        .buttonStyle(.plain)
    }
}
