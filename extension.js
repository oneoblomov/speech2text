import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';

// Import modular components
import { STTPanelButton } from './ui/PanelButton.js';
import { STTOverlay } from './ui/Overlay.js';
import { AudioRecorder } from './audio/AudioRecorder.js';
import { Utils, Constants } from './utils/Utils.js';
import { initTranslation, _ } from './utils/Translation.js';
import { ModelManager } from './utils/ModelManager.js';
import { TranslationManager } from './utils/TranslationManager.js';

export default class SpeechToTextExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this.panelButton = null;
        this.overlay = null;
        this.audioRecorder = null;
        this.modelManager = null;
        this.translationManager = null;
        this.settings = null;
        this.recordingMode = Constants.RECORDING_MODES.MICROPHONE;
        this.isRecording = false;
    }

    enable() {
        // Initialize translation system first
        this.translator = initTranslation(this);
        
        this.settings = this.getSettings();
        
        // Initialize managers
        this.modelManager = new ModelManager(this.settings);
        this.translationManager = new TranslationManager(this.settings);
        
        // Initialize UI components
        this.panelButton = new STTPanelButton(this.uuid, this.settings);
        this.overlay = new STTOverlay(this.settings);
        
        // Connect panel button signals
        this.panelButton.connectSignals({
            onModeChange: (mode) => this._setRecordingMode(mode),
            onToggleRecording: () => this._toggleRecording(),
            onCopyText: () => this._copyToClipboard(),
            onClearText: () => this._clearText(),
            onOverlayToggle: (item, state) => this.settings.set_boolean('show-overlay', state),
            onShowSettings: () => Utils.openPreferences(this.metadata.uuid)
        });
        
        // Add to panel
        this.panelButton.addToPanel();
        
        // Set initial recording mode
        this._setRecordingMode(Constants.RECORDING_MODES.MICROPHONE);
        
        // Auto-record if enabled
        if (this.settings.get_boolean('auto-record')) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this._startRecording();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    disable() {
        // Stop any active recording first
        this._stopRecording();
        
        // Cleanup panel button with proper removal
        if (this.panelButton) {
            try {
                // Remove from panel status area
                Main.panel.statusArea[this.uuid] = null;
                delete Main.panel.statusArea[this.uuid];
                
                // Destroy the button
                this.panelButton.destroy();
                this.panelButton = null;
            } catch (error) {
                console.log(`Panel button cleanup error: ${error.message}`);
            }
        }
        
        // Cleanup overlay
        if (this.overlay) {
            try {
                this.overlay.destroy();
                this.overlay = null;
            } catch (error) {
                console.log(`Overlay cleanup error: ${error.message}`);
            }
        }
        
        // Cleanup managers
        if (this.translationManager) {
            this.translationManager.clearCache();
            this.translationManager = null;
        }
        
        this.modelManager = null;
        
        // Clear settings reference
        this.settings = null;
        
        // Clear translator reference
        this.translator = null;
        
        console.log('Speech to Text extension disabled and cleaned up');
    }

    async _translateText(text) {
        if (!this.translationManager || !text) {
            throw new Error('Translation manager not available or empty text');
        }
        
        try {
            const result = await this.translationManager.translateText(text);
            return result;
        } catch (error) {
            console.log(`Translation failed: ${error.message}`);
            throw error;
        }
    }

    _setRecordingMode(mode) {
        if (!Utils.isValidRecordingMode(mode)) return;
        
        this.recordingMode = mode;
        this.panelButton.updateRecordingMode(mode);
    }

    _toggleRecording() {
        if (this.isRecording) {
            this._stopRecording();
        } else {
            this._startRecording();
        }
    }

    _startRecording() {
        if (this.isRecording) return;
        
        try {
            this.audioRecorder = new AudioRecorder(this.path);
            
            // Set current model path from settings
            const currentModelPath = this.settings.get_string('current-model-path');
            if (currentModelPath) {
                this.audioRecorder.setModelPath(currentModelPath);
            }
            
            this.audioRecorder.startRecording(this.recordingMode, {
                onText: (text) => this._onTextRecognized(text),
                onStatus: (status, type) => this._onRecordingStatus(status, type),
                onAudioLevel: (level) => this._onAudioLevelChange(level)
            });
            
            this.isRecording = true;
            this.panelButton.updateRecordingState(true);
            
            const statusText = Utils.formatStatusMessage(
                `🎤 ${Utils.getRecordingModeText(this.recordingMode)} recording started`, 
                Constants.STATUS_TYPES.RECORDING
            );
            this.overlay.updateText(statusText);
            
        } catch (error) {
            Main.notify('Audio Recording Error', `Failed to start recording: ${error.message}`);
            console.log(`Audio recording error: ${error.message}`);
        }
    }

    _stopRecording() {
        if (!this.isRecording || !this.audioRecorder) return;
        
        this.audioRecorder.stopRecording();
        this.audioRecorder = null;
        
        this.isRecording = false;
        this.panelButton.updateRecordingState(false);
        this.panelButton.resetToDefaultIcon();
        
        this.overlay.updateText(Utils.formatStatusMessage(
            '⏹️ Recording stopped\n📝 Processing...\n⏳ Please wait.',
            Constants.STATUS_TYPES.STOPPED
        ));
    }

    _onTextRecognized(text) {
        // Immediate update with performance optimization
        this.panelButton.updateText(text);
        
        // Update overlay immediately for real-time feedback
        const statusText = Utils.formatStatusMessage(
            `🔊 "${text}"`,
            Constants.STATUS_TYPES.RECOGNIZED
        );
        this.overlay.updateText(statusText);
        
        // Handle translation if enabled (async, non-blocking)
        if (this.settings.get_boolean('enable-translation') && 
            this.settings.get_boolean('auto-translate') && text && text.length > 3) {
            
            this._translateText(text).then(translationResult => {
                const displayText = this.translationManager.formatTranslationForDisplay(
                    translationResult, 
                    this.settings.get_boolean('show-original-text')
                );
                
                this.overlay.updateText(Utils.formatStatusMessage(
                    displayText,
                    Constants.STATUS_TYPES.RECOGNIZED
                ));
                
                // Update panel with translated text if configured
                if (!this.settings.get_boolean('show-original-text')) {
                    this.panelButton.updateText(translationResult.translated);
                }
            }).catch(error => {
                // Silent fail for translation errors during real-time updates
            });
        }
        
        // Auto-copy if enabled (non-blocking, less frequent for partial updates)
        if (this.settings.get_boolean('auto-copy') && text && text.length > 10) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                Utils.copyToClipboard(text);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _onRecordingStatus(status, type) {
        this.overlay.updateText(Utils.formatStatusMessage(status, type));
        
        if (type === Constants.STATUS_TYPES.COMPLETED) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
                this.overlay.updateText('Konuşmaya hazır...\nMikrofon düğmesine basarak\nkonuşmaya başlayabilirsiniz.');
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _onAudioLevelChange(level) {
        this.panelButton.updateAudioLevel(level);
    }

    _copyToClipboard() {
        const text = this.panelButton.getText();
        if (Utils.copyToClipboard(text)) {
            if (this.settings.get_boolean('auto-clear')) {
                this._clearText();
            }
        }
    }

    _clearText() {
        this.panelButton.updateText('');
        this.overlay.updateText('Konuşmaya hazır...\nBuraya tanınan metin görünecek.');
    }
}
