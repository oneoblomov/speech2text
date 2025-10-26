import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * High-performance utility functions for the Speech to Text extension
 */
export class Utils {
    static _clipboardCache = null;
    static _lastClipboardUpdate = 0;
    
    /**
     * Copy text to clipboard with caching and feedback
     */
    static copyToClipboard(text) {
        if (!text) return false;
        
        const now = Date.now();
        
        // Prevent excessive clipboard operations
        if (this._clipboardCache === text && (now - this._lastClipboardUpdate) < 1000) {
            return true;
        }
        
        try {
            let clipboard = St.Clipboard.get_default();
            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
            
            this._clipboardCache = text;
            this._lastClipboardUpdate = now;
            
            // Show user feedback
            Main.notify('📋 Copied', `"${this.truncateText(text, 30)}" copied to clipboard`);
            
            return true;
        } catch (error) {
            console.log(`Clipboard error: ${error.message}`);
            Main.notify('❌ Error', 'Failed to copy to clipboard');
            return false;
        }
    }

    /**
     * Open extension preferences with error handling
     */
    static openPreferences(uuid) {
        try {
            Gio.Subprocess.new(['gnome-extensions', 'prefs', uuid], Gio.SubprocessFlags.NONE);
            return true;
        } catch (error) {
            console.log(`Failed to open preferences: ${error.message}`);
            try {
                // Fallback method
                GLib.spawn_command_line_async(`gnome-extensions prefs ${uuid}`);
                return true;
            } catch (fallbackError) {
                console.log(`Fallback preferences open failed: ${fallbackError.message}`);
                Main.notify('❌ Error', 'Cannot open settings');
                return false;
            }
        }
    }

    /**
     * Smart text truncation with word boundary awareness
     */
    static truncateText(text, maxLength = 50) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        
        // Try to truncate at word boundary
        const truncated = text.substring(0, maxLength - 3);
        const lastSpace = truncated.lastIndexOf(' ');
        
        if (lastSpace > maxLength * 0.7) {
            return truncated.substring(0, lastSpace) + '...';
        }
        
        return truncated + '...';
    }

    /**
     * Enhanced status message formatting with performance optimization
     */
    static formatStatusMessage(message, type) {
        const statusConfig = {
            recording: { emoji: '🔴', color: '#e74c3c' },
            listening: { emoji: '🎤', color: '#3498db' },
            recognized: { emoji: '🔊', color: '#27ae60' },
            stopped: { emoji: '⏹️', color: '#f39c12' },
            completed: { emoji: '✅', color: '#27ae60' },
            error: { emoji: '❌', color: '#e74c3c' },
            processing: { emoji: '⚙️', color: '#9b59b6' }
        };
        
        const config = statusConfig[type] || { emoji: '', color: '#7f8c8d' };
        return config.emoji ? `${config.emoji} ${message}` : message;
    }

    /**
     * Validate recording mode
     */
    static isValidRecordingMode(mode) {
        return mode === 1 || mode === 2;
    }

    /**
     * Get recording mode display text with emojis
     */
    static getRecordingModeText(mode) {
        return mode === 1 ? 'Microphone' : 'System Audio';
    }

    /**
     * High-performance debounce with immediate option
     */
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    /**
     * Throttle function calls for better performance
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Performance monitoring utilities
     */
    static performanceMonitor = {
        startTime: null,
        markers: {},
        
        start(label = 'default') {
            this.markers[label] = performance.now();
        },
        
        end(label = 'default') {
            if (this.markers[label]) {
                const duration = performance.now() - this.markers[label];
                console.log(`Performance [${label}]: ${duration.toFixed(2)}ms`);
                delete this.markers[label];
                return duration;
            }
            return 0;
        }
    };

    /**
     * Check system capabilities
     */
    static checkSystemCapabilities() {
        const capabilities = {
            pulseaudio: false,
            vosk: false,
            recording: false
        };
        
        try {
            // Check PulseAudio
            GLib.spawn_command_line_sync('pactl info');
            capabilities.pulseaudio = true;
        } catch (e) {
            console.log('PulseAudio not available');
        }
        
        return capabilities;
    }
}

/**
 * Optimized constants with performance considerations
 */
export const Constants = {
    RECORDING_MODES: {
        MICROPHONE: 1,
        SYSTEM_AUDIO: 2
    },
    
    STATUS_TYPES: {
        RECORDING: 'recording',
        LISTENING: 'listening',
        RECOGNIZED: 'recognized',
        STOPPED: 'stopped',
        COMPLETED: 'completed',
        ERROR: 'error',
        PROCESSING: 'processing'
    },
    
    AUDIO_LEVELS: {
        MUTED: 0,
        LOW: 1,
        MEDIUM: 2,
        HIGH: 3
    },
    
    // Optimized update intervals for real-time performance
    UPDATE_INTERVALS: {
        AUDIO_LEVEL: 30,   // Faster audio feedback
        TEXT_MONITOR: 40,  // Faster text updates
        STATUS_UPDATE: 100, // Moderate status updates
        UI_THROTTLE: 16    // 60fps UI updates
    },
    
    PERFORMANCE: {
        MAX_TEXT_LENGTH: 5000,
        CACHE_TIMEOUT: 30000, // 30 seconds
        DEBOUNCE_DELAY: 100,
        THROTTLE_LIMIT: 50
    }
};
