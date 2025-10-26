import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * Performance-optimized audio recorder with streaming capabilities
 */
export class AudioRecorder {
    constructor(extensionPath) {
        this.extensionPath = extensionPath;
        this.isRecording = false;
        this.process = null;
        this.textMonitor = null;
        this.audioLevelMonitor = null;
        this.lastTextContent = '';
        this.lastAudioLevel = 0;
        
        // File paths for faster access
        this.textFilePath = `${extensionPath}/ses/recognized_text.txt`;
        this.levelFilePath = `${extensionPath}/ses/audio_level.txt`;
        
        this.callbacks = {
            onText: null,
            onStatus: null,
            onAudioLevel: null
        };
        
        // Performance tracking
        this.performanceStats = {
            textUpdates: 0,
            audioUpdates: 0,
            startTime: null
        };
    }

    /**
     * Set the current model path for C++ backend
     */
    setModelPath(modelPath) {
        if (!modelPath) return false;
        
        try {
            const modelConfigPath = `${this.extensionPath}/ses/current_model.txt`;
            GLib.file_set_contents(modelConfigPath, modelPath);
            return true;
        } catch (error) {
            console.log(`Failed to set model path: ${error.message}`);
            return false;
        }
    }

    /**
     * Start recording with optimized monitoring
     * @param {number} mode - 1: Microphone, 2: System audio
     * @param {Object} callbacks - {onText, onStatus, onAudioLevel}
     */
    startRecording(mode, callbacks = {}) {
        if (this.isRecording) {
            throw new Error('Recording already in progress');
        }

        this.callbacks = { ...this.callbacks, ...callbacks };
        this.performanceStats.startTime = Date.now();
        this.performanceStats.textUpdates = 0;
        this.performanceStats.audioUpdates = 0;
        
        this._clearOutputFiles();
        this._startOptimizedMonitoring();
        this._startCppProcess(mode);
        
        this.isRecording = true;
        this._notifyStatus(`${mode === 1 ? 'Mikrofon' : 'Sistem sesi'} kaydı başladı`, 'recording');
    }

    /**
     * Stop recording and cleanup
     */
    stopRecording() {
        if (!this.isRecording || !this.process) return;

        try {
            GLib.spawn_command_line_sync(`kill -2 ${this.process.pid}`);
            this._notifyStatus('Kayıt durduruluyor...', 'stopping');
        } catch (error) {
            console.log(`Recording stop error: ${error.message}`);
        }
        
        this._logPerformanceStats();
        this._cleanup();
    }

    /**
     * Optimized monitoring with combined file checks
     */
    _startOptimizedMonitoring() {
        // Ultra-fast monitoring for real-time performance (50ms for better stability)
        this.textMonitor = GLib.timeout_add(GLib.PRIORITY_HIGH, 50, () => {
            if (!this.isRecording) return GLib.SOURCE_REMOVE;
            
            // Check both files in parallel
            this._checkFiles();
            return GLib.SOURCE_CONTINUE;
        });
    }

    /**
     * Combined file checking for better performance
     */
    _checkFiles() {
        // Use GLib.spawn_async for faster file reading
        try {
            // Read text file
            let [textSuccess, textContents] = GLib.file_get_contents(this.textFilePath);
            if (textSuccess) {
                const currentText = new TextDecoder().decode(textContents).trim();
                if (currentText !== this.lastTextContent) {
                    this.lastTextContent = currentText;
                    this.performanceStats.textUpdates++;
                    
                    if (this.callbacks.onText && currentText) {
                        this.callbacks.onText(currentText);
                    }
                    
                    this._notifyStatus(
                        currentText ? `🔊 "${currentText}"` : '🎤 Dinliyor...', 
                        'text_update'
                    );
                }
            }
            
            // Read audio level file
            let [levelSuccess, levelContents] = GLib.file_get_contents(this.levelFilePath);
            if (levelSuccess) {
                const levelStr = new TextDecoder().decode(levelContents).trim();
                const level = parseInt(levelStr) || 0;
                
                if (level !== this.lastAudioLevel) {
                    this.lastAudioLevel = level;
                    this.performanceStats.audioUpdates++;
                    
                    const iconLevel = Math.min(3, Math.floor(level / 3));
                    if (this.callbacks.onAudioLevel) {
                        this.callbacks.onAudioLevel(iconLevel);
                    }
                }
            }
        } catch (error) {
            // Silent fail for file read errors during high-frequency monitoring
        }
    }

    _startCppProcess(mode) {
        const workingDirectory = `${this.extensionPath}/ses`;
        const command = `echo "${mode}" | ${workingDirectory}/audio_recorder`;
        
        try {
            let [success, pid] = GLib.spawn_async(
                workingDirectory,
                ['/bin/bash', '-c', command],
                null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null
            );

            if (!success) {
                throw new Error('Failed to start C++ audio recorder');
            }

            this.process = { pid };
            
            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
                this._onProcessFinished(status);
            });
            
        } catch (error) {
            this._cleanup();
            throw new Error(`Failed to start recording: ${error.message}`);
        }
    }

    _clearOutputFiles() {
        try {
            // Use faster file operations
            GLib.file_set_contents(this.textFilePath, '');
            GLib.file_set_contents(this.levelFilePath, '0');
        } catch (error) {
            // Files will be created by C++ process if they don't exist
        }
        
        // Reset cached values
        this.lastTextContent = '';
        this.lastAudioLevel = 0;
    }

    _onProcessFinished(status) {
        this._cleanup();
        this._notifyStatus('Kayıt tamamlandı', 'finished');
    }

    _cleanup() {
        this.isRecording = false;
        this.process = null;
        
        if (this.textMonitor) {
            GLib.Source.remove(this.textMonitor);
            this.textMonitor = null;
        }
        
        // Reset audio level
        if (this.callbacks.onAudioLevel) {
            this.callbacks.onAudioLevel(0);
        }
        
        // Clear cached values
        this.lastTextContent = '';
        this.lastAudioLevel = 0;
    }

    _notifyStatus(message, type) {
        if (this.callbacks.onStatus) {
            this.callbacks.onStatus(message, type);
        }
    }

    _logPerformanceStats() {
        if (this.performanceStats.startTime) {
            const duration = Date.now() - this.performanceStats.startTime;
            console.log(`AudioRecorder Performance Stats:
                Duration: ${duration}ms
                Text Updates: ${this.performanceStats.textUpdates}
                Audio Updates: ${this.performanceStats.audioUpdates}
                Update Rate: ${((this.performanceStats.textUpdates + this.performanceStats.audioUpdates) / (duration / 1000)).toFixed(2)} updates/sec`);
        }
    }

    get recording() {
        return this.isRecording;
    }

    get stats() {
        return this.performanceStats;
    }
}

/**
 * Optimized utility functions for audio operations
 */
export const AudioUtils = {
    /**
     * Check if system audio monitor is available with caching
     */
    checkSystemAudioMonitor() {
        if (this._cachedMonitor) {
            return this._cachedMonitor;
        }
        
        try {
            let [success, output] = GLib.spawn_command_line_sync(
                "pactl info | grep 'Default Sink' | cut -d' ' -f3"
            );
            
            if (success && output) {
                const monitor = new TextDecoder().decode(output).trim() + '.monitor';
                this._cachedMonitor = monitor;
                
                // Cache expires after 30 seconds
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30000, () => {
                    this._cachedMonitor = null;
                    return GLib.SOURCE_REMOVE;
                });
                
                return monitor;
            }
        } catch (error) {
            console.log(`System audio monitor check error: ${error.message}`);
        }
        return null;
    },

    _cachedMonitor: null
};
