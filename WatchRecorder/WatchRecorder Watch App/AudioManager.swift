import Foundation
import AVFoundation
import WatchKit

class AudioManager: NSObject, ObservableObject {
    // MARK: - Published State
    @Published var isRecording = false
    @Published var isPlaying = false
    @Published var clips: [AudioClip] = []
    @Published var elapsedTime: TimeInterval = 0
    @Published var currentlyPlayingID: UUID? = nil
    @Published var audioLevel: Float = 0

    // MARK: - Private
    private var recorder: AVAudioRecorder?
    private var player: AVAudioPlayer?
    private var timer: Timer?
    private var levelTimer: Timer?
    private let maxDuration: TimeInterval = 120 // 2 minutes

    private var documentsURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    override init() {
        super.init()
        loadClips()
        configureAudioSession()
    }

    // MARK: - Audio Session
    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .default, options: [])
        try? session.setActive(true)
    }

    // MARK: - Recording
    func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }

    private func startRecording() {
        let fileName = "clip_\(Int(Date().timeIntervalSince1970)).m4a"
        let fileURL = documentsURL.appendingPathComponent(fileName)

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]

        do {
            recorder = try AVAudioRecorder(url: fileURL, settings: settings)
            recorder?.delegate = self
            recorder?.isMeteringEnabled = true
            recorder?.record()

            isRecording = true
            elapsedTime = 0
            WKInterfaceDevice.current().play(.start)

            timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                guard let self else { return }
                self.elapsedTime += 0.1
                if self.elapsedTime >= self.maxDuration {
                    self.stopRecording()
                }
            }

            levelTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
                guard let self, let rec = self.recorder else { return }
                rec.updateMeters()
                let power = rec.averagePower(forChannel: 0)
                // Convert dB (-60..0) to 0..1
                let normalized = max(0, (power + 60) / 60)
                DispatchQueue.main.async { self.audioLevel = normalized }
            }
        } catch {
            print("Recording failed: \(error)")
        }
    }

    private func stopRecording() {
        recorder?.stop()
        timer?.invalidate()
        levelTimer?.invalidate()
        timer = nil
        levelTimer = nil
        isRecording = false
        audioLevel = 0
        WKInterfaceDevice.current().play(.stop)

        if let url = recorder?.url {
            let clip = AudioClip(url: url, duration: elapsedTime, date: Date())
            DispatchQueue.main.async {
                self.clips.insert(clip, at: 0)
                self.saveClipMetadata()
            }
        }
    }

    // MARK: - Playback
    func togglePlayback(clip: AudioClip) {
        if isPlaying && currentlyPlayingID == clip.id {
            stopPlayback()
        } else {
            playClip(clip)
        }
    }

    private func playClip(_ clip: AudioClip) {
        stopPlayback()
        do {
            player = try AVAudioPlayer(contentsOf: clip.url)
            player?.delegate = self
            player?.play()
            isPlaying = true
            currentlyPlayingID = clip.id
            WKInterfaceDevice.current().play(.click)
        } catch {
            print("Playback failed: \(error)")
        }
    }

    func stopPlayback() {
        player?.stop()
        player = nil
        isPlaying = false
        currentlyPlayingID = nil
    }

    // MARK: - Delete
    func deleteClip(_ clip: AudioClip) {
        try? FileManager.default.removeItem(at: clip.url)
        clips.removeAll { $0.id == clip.id }
        saveClipMetadata()
        if currentlyPlayingID == clip.id { stopPlayback() }
    }

    // MARK: - Persistence
    private var metadataURL: URL {
        documentsURL.appendingPathComponent("clips_metadata.json")
    }

    private func saveClipMetadata() {
        let data = try? JSONEncoder().encode(clips)
        try? data?.write(to: metadataURL)
    }

    private func loadClips() {
        guard let data = try? Data(contentsOf: metadataURL),
              let saved = try? JSONDecoder().decode([AudioClip].self, from: data) else { return }
        // Filter to clips whose files still exist
        clips = saved.filter { FileManager.default.fileExists(atPath: $0.url.path) }
    }
}

// MARK: - AVAudioRecorderDelegate
extension AudioManager: AVAudioRecorderDelegate {
    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if isRecording { stopRecording() }
    }
}

// MARK: - AVAudioPlayerDelegate
extension AudioManager: AVAudioPlayerDelegate {
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        DispatchQueue.main.async {
            self.isPlaying = false
            self.currentlyPlayingID = nil
        }
    }
}

// MARK: - Model
struct AudioClip: Identifiable, Codable {
    let id: UUID
    let url: URL
    let duration: TimeInterval
    let date: Date

    init(url: URL, duration: TimeInterval, date: Date) {
        self.id = UUID()
        self.url = url
        self.duration = duration
        self.date = date
    }

    var displayName: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, h:mm a"
        return formatter.string(from: date)
    }

    var displayDuration: String {
        let total = Int(duration)
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}
