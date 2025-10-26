import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import { _ } from '../utils/Translation.js';

/**
 * High-performance panel button with smooth animations and immediate feedback
 */
export class STTPanelButton {
    constructor(uuid, settings) {
        this.uuid = uuid;
        this.settings = settings;
        this.isRecording = false;
        this.recognizedText = '';
        this.lastUpdateTime = 0;
        this.animationTimeout = null;
        
        this._createButton();
        this._createMenu();
        this._setupAudioLevelIcons();
        this._setupPerformanceOptimizations();
    }

    _createButton() {
        this.button = new PanelMenu.Button(0.0, 'Speech to Text', false);
        
        // Add smooth hover effects
        this.button.connect('enter-event', () => this._onHoverEnter());
        this.button.connect('leave-event', () => this._onHoverLeave());
        
        this.defaultIcon = new St.Icon({ 
            icon_name: 'audio-input-microphone-symbolic', 
            style_class: 'system-status-icon'
        });
        this.button.add_child(this.defaultIcon);
    }

    _createMenu() {
        // Recording mode submenu with better icons
        this.modeSubmenu = new PopupMenu.PopupSubMenuMenuItem(_('🎤 Recording Mode: Microphone'));
        this.microphoneMode = new PopupMenu.PopupMenuItem(_('🎤 Microphone'));
        this.systemAudioMode = new PopupMenu.PopupMenuItem(_('🔊 System Audio'));
        this.modeSubmenu.menu.addMenuItem(this.microphoneMode);
        this.modeSubmenu.menu.addMenuItem(this.systemAudioMode);
        this.button.menu.addMenuItem(this.modeSubmenu);
        
        this.button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Recording controls with immediate feedback
        this.recordButton = new PopupMenu.PopupMenuItem(_('🎤 Start Recording'));
        this.recordButton.connect('activate', () => this._onRecordButtonClicked());
        this.button.menu.addMenuItem(this.recordButton);
        
        this.button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Enhanced text display with scrolling support
        this.textDisplay = new PopupMenu.PopupMenuItem(_('✨ Ready to record...'));
        this.textDisplay.reactive = false;
        this.textDisplay.label.clutter_text.set_line_wrap(true);
        this.textDisplay.label.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.button.menu.addMenuItem(this.textDisplay);
        
        this.button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Text actions with visual feedback
        this.copyButton = new PopupMenu.PopupMenuItem(_('📋 Copy to Clipboard'));
        this.clearButton = new PopupMenu.PopupMenuItem(_('🗑️ Clear Text'));
        this.button.menu.addMenuItem(this.copyButton);
        this.button.menu.addMenuItem(this.clearButton);
        
        this.button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Settings with improved UX
        this.overlayToggle = new PopupMenu.PopupSwitchMenuItem(
            '📺 Show Screen Overlay', 
            this.settings.get_boolean('show-overlay')
        );
        this.button.menu.addMenuItem(this.overlayToggle);
        
        this.settingsButton = new PopupMenu.PopupMenuItem('⚙️ Settings');
        this.button.menu.addMenuItem(this.settingsButton);
        
        // Add status indicator at bottom
        this.statusIndicator = new PopupMenu.PopupMenuItem(_('🟢 Ready'));
        this.statusIndicator.reactive = false;
        this.statusIndicator.label.style = 'font-size: 10px; color: #888;';
        this.button.menu.addMenuItem(this.statusIndicator);
    }

    _setupAudioLevelIcons() {
        this.audioLevelIcons = [
            new St.Icon({ 
                icon_name: 'audio-volume-muted-symbolic', 
                style_class: 'system-status-icon audio-level-0' 
            }),
            new St.Icon({ 
                icon_name: 'audio-volume-low-symbolic', 
                style_class: 'system-status-icon audio-level-1' 
            }),
            new St.Icon({ 
                icon_name: 'audio-volume-medium-symbolic', 
                style_class: 'system-status-icon audio-level-2' 
            }),
            new St.Icon({ 
                icon_name: 'audio-volume-high-symbolic', 
                style_class: 'system-status-icon audio-level-3' 
            })
        ];
        this.currentAudioLevel = 0;
        this.lastAudioLevel = -1; // Force initial update
    }

    _setupPerformanceOptimizations() {
        // Cache DOM queries for better performance
        this.cachedElements = {
            button: this.button,
            textDisplay: this.textDisplay,
            recordButton: this.recordButton,
            statusIndicator: this.statusIndicator
        };
        
        // Throttle updates to prevent excessive redraws
        this.updateThrottle = {
            text: 0,
            audioLevel: 0,
            status: 0
        };
    }

    _onHoverEnter() {
        if (this.defaultIcon) {
            this.defaultIcon.add_style_class_name('panel-button-hover');
        }
    }

    _onHoverLeave() {
        if (this.defaultIcon) {
            this.defaultIcon.remove_style_class_name('panel-button-hover');
        }
    }

    _onRecordButtonClicked() {
        // Immediate visual feedback
        this.recordButton.label.text = this.isRecording ? '⏹️ Stopping...' : '🎙️ Starting...';
        
        // Disable button briefly to prevent double-clicks
        this.recordButton.reactive = false;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this.recordButton.reactive = true;
            return GLib.SOURCE_REMOVE;
        });
    }

    connectSignals(callbacks) {
        this.microphoneMode.connect('activate', () => {
            this._showModeChangeFeedback('🎤 Microphone selected');
            callbacks.onModeChange(1);
        });
        
        this.systemAudioMode.connect('activate', () => {
            this._showModeChangeFeedback('🔊 System Audio selected');
            callbacks.onModeChange(2);
        });
        
        this.recordButton.connect('activate', callbacks.onToggleRecording);
        
        this.copyButton.connect('activate', () => {
            this._showActionFeedback('📋 Copied!');
            callbacks.onCopyText();
        });
        
        this.clearButton.connect('activate', () => {
            this._showActionFeedback('🗑️ Cleared!');
            callbacks.onClearText();
        });
        
        this.overlayToggle.connect('toggled', callbacks.onOverlayToggle);
        this.settingsButton.connect('activate', callbacks.onShowSettings);
    }

    _showModeChangeFeedback(message) {
        const originalText = this.statusIndicator.label.text;
        this.statusIndicator.label.text = message;
        
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            this.statusIndicator.label.text = originalText;
            return GLib.SOURCE_REMOVE;
        });
    }

    _showActionFeedback(message) {
        this._showModeChangeFeedback(message);
    }

    addToPanel() {
        Main.panel.addToStatusArea(this.uuid, this.button);
    }

    destroy() {
        // Cleanup animations
        if (this.animationTimeout) {
            GLib.Source.remove(this.animationTimeout);
            this.animationTimeout = null;
        }
        
        // Disconnect all signals
        try {
            if (this.button && this.button.menu) {
                this.button.menu.removeAll();
            }
        } catch (error) {
            console.log(`Menu cleanup error: ${error.message}`);
        }
        
        // Remove from panel if still there
        try {
            if (this.button && Main.panel.statusArea[this.uuid]) {
                Main.panel.statusArea[this.uuid] = null;
                delete Main.panel.statusArea[this.uuid];
            }
        } catch (error) {
            console.log(`Status area cleanup error: ${error.message}`);
        }
        
        // Destroy button widget
        if (this.button) {
            try {
                this.button.destroy();
            } catch (error) {
                console.log(`Button destroy error: ${error.message}`);
            }
            this.button = null;
        }
        
        // Clear cached elements
        this.cachedElements = null;
        this.audioLevelIcons = null;
        this.defaultIcon = null;
        
        console.log('PanelButton destroyed and cleaned up');
    }

    updateRecordingState(isRecording, text = 'Start Recording') {
        this.isRecording = isRecording;
        
        // Immediate status update
        const buttonText = isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording';
        const statusText = isRecording ? '🔴 Recording...' : '🟢 Ready';
        
        this.recordButton.label.text = buttonText;
        this.statusIndicator.label.text = statusText;
        
        // Add recording animation class
        if (isRecording) {
            this.defaultIcon.add_style_class_name('recording-active');
        } else {
            this.defaultIcon.remove_style_class_name('recording-active');
        }
    }

    updateRecordingMode(mode) {
        const modeText = mode === 1 ? '🎤 Microphone' : '🔊 System Audio';
        this.modeSubmenu.label.text = `Recording Mode: ${modeText}`;
        
        this.microphoneMode.setOrnament(
            mode === 1 ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE
        );
        this.systemAudioMode.setOrnament(
            mode === 2 ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE
        );
    }

    updateText(text) {
        // Throttle text updates for better performance
        const now = Date.now();
        if (now - this.updateThrottle.text < 50) return;
        this.updateThrottle.text = now;
        
        this.recognizedText = text;
        
        let displayText = text;
        if (displayText && displayText.length > 100) {
            displayText = displayText.substring(0, 97) + '...';
        }
        
        const finalText = displayText || '💭 Listening for speech...';
        
        // Only update if text actually changed
        if (this.textDisplay.label.text !== finalText) {
            this.textDisplay.label.text = finalText;
            
            // Show update animation
            this.textDisplay.add_style_class_name('text-updated');
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                this.textDisplay.remove_style_class_name('text-updated');
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    updateAudioLevel(level) {
        // Throttle audio level updates and avoid unnecessary changes
        const now = Date.now();
        if (now - this.updateThrottle.audioLevel < 30 || level === this.lastAudioLevel) return;
        this.updateThrottle.audioLevel = now;
        this.lastAudioLevel = level;
        
        if (level < 0 || level >= this.audioLevelIcons.length) return;
        
        this.currentAudioLevel = level;
        
        if (this.isRecording) {
            // Smooth icon transition
            this.button.remove_all_children();
            this.button.add_child(this.audioLevelIcons[level]);
        }
    }

    resetToDefaultIcon() {
        this.button.remove_all_children();
        this.button.add_child(this.defaultIcon);
        this.lastAudioLevel = -1; // Reset for next recording session
    }

    getText() {
        return this.recognizedText;
    }

    // Performance monitoring
    getPerformanceStats() {
        return {
            lastUpdateTime: this.lastUpdateTime,
            updateThrottle: { ...this.updateThrottle },
            currentAudioLevel: this.currentAudioLevel,
            isRecording: this.isRecording
        };
    }
}
