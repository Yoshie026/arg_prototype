import SwiftUI

struct RecordView: View {
    @EnvironmentObject var audioManager: AudioManager

    var body: some View {
        VStack(spacing: 0) {
            // Status + Timer
            VStack(spacing: 2) {
                Text(audioManager.isRecording ? "REC" : "READY")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(audioManager.isRecording ? .red : .secondary)

                Text(timerText)
                    .font(.system(size: 36, weight: .thin).monospacedDigit())
                    .foregroundStyle(.primary)
            }
            .padding(.top, 8)

            Spacer()

            // Waveform
            WaveformView(level: audioManager.audioLevel, isRecording: audioManager.isRecording)
                .frame(height: 32)
                .padding(.horizontal, 8)

            Spacer()

            // Record Button
            Button(action: { audioManager.toggleRecording() }) {
                ZStack {
                    Circle()
                        .fill(.red)
                        .frame(width: 56, height: 56)

                    if audioManager.isRecording {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(.white)
                            .frame(width: 18, height: 18)
                    } else {
                        Circle()
                            .fill(.white)
                            .frame(width: 22, height: 22)
                    }
                }
            }
            .buttonStyle(.plain)
            .overlay {
                if audioManager.isRecording {
                    Circle()
                        .stroke(.red.opacity(0.4), lineWidth: 1.5)
                        .frame(width: 66, height: 66)
                        .scaleEffect(pulseScale)
                        .opacity(pulseOpacity)
                        .animation(.easeOut(duration: 1.4).repeatForever(autoreverses: false), value: pulseScale)
                }
            }
            .onAppear { startPulse() }

            Spacer().frame(height: 10)

            Text(audioManager.isRecording ? "Tap to stop" : "Tap to record")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .padding(.bottom, 6)
        }
        .navigationTitle("Memo")
    }

    // MARK: - Timer text
    private var timerText: String {
        let t = Int(audioManager.elapsedTime)
        return String(format: "%d:%02d", t / 60, t % 60)
    }

    // MARK: - Pulse animation
    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 0.6

    private func startPulse() {
        pulseScale = 1.5
        pulseOpacity = 0
    }
}

// MARK: - Waveform
struct WaveformView: View {
    let level: Float
    let isRecording: Bool

    @State private var bars: [CGFloat] = Array(repeating: 0.05, count: 24)

    var body: some View {
        HStack(spacing: 2) {
            ForEach(Array(bars.enumerated()), id: \.offset) { _, h in
                Capsule()
                    .fill(isRecording ? Color.red.opacity(0.8) : Color.secondary.opacity(0.3))
                    .frame(width: 3, height: max(4, h * 28))
                    .animation(.easeOut(duration: 0.08), value: h)
            }
        }
        .onChange(of: level) { _, newLevel in
            guard isRecording else { return }
            bars.removeFirst()
            let jitter = CGFloat.random(in: 0.7...1.3)
            bars.append(CGFloat(newLevel) * jitter)
        }
        .onChange(of: isRecording) { _, recording in
            if !recording {
                withAnimation(.easeOut(duration: 0.4)) {
                    bars = Array(repeating: 0.05, count: 24)
                }
            }
        }
    }
}
