import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import Gio from 'gi://Gio';

/**
 * Overlay widget for displaying speech to text results
 */
export class STTOverlay {
    constructor(settings) {
        this.settings = settings;
        this.overlay = null;
        this.overlayBox = null;
        this.overlayText = null;
        
        this._createOverlay();
        this._connectSettings();
    }

    _createOverlay() {
        this.overlay = new St.Widget({ 
            layout_manager: new Clutter.BinLayout(), 
            reactive: false, 
            can_focus: false, 
            track_hover: false 
        });
        
        this.overlayBox = new St.BoxLayout({ 
            style_class: 'stt-overlay-box', 
            vertical: false, 
            reactive: false 
        });
        
        this.overlayText = new St.Label({ 
            style_class: 'stt-overlay-text', 
            text: 'Konuşmaya hazır...\nBuraya tanınan metin görünecek.', 
            reactive: false 
        });
        
        this.overlayText.clutter_text.set_line_wrap(true);
        this.overlayText.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.overlayText.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        
        this.overlayBox.add_child(this.overlayText);
        this.overlay.add_child(this.overlayBox);
        
        Main.layoutManager.addChrome(this.overlay, { 
            affectsStruts: false, 
            trackFullscreen: true 
        });
        
        this._updateStyle();
        this._updatePosition();
        this._updateVisibility();
    }

    _connectSettings() {
        const overlayKeys = [
            'show-overlay', 'overlay-horizontal-position', 'overlay-vertical-position',
            'overlay-x-offset', 'overlay-y-offset', 'overlay-width', 'overlay-height',
            'overlay-orientation', 'overlay-opacity', 'overlay-theme',
            'overlay-font-family', 'overlay-font-size'
        ];
        
        overlayKeys.forEach(key => {
            this.settings.connect(`changed::${key}`, () => {
                if (key === 'show-overlay') {
                    this._updateVisibility();
                } else if (['overlay-horizontal-position', 'overlay-vertical-position',
                           'overlay-x-offset', 'overlay-y-offset', 'overlay-width',
                           'overlay-height', 'overlay-orientation'].includes(key)) {
                    this._updatePosition();
                } else {
                    this._updateStyle();
                }
            });
        });
    }

    _updateVisibility() {
        const showOverlay = this.settings.get_boolean('show-overlay');
        if (this.overlay) {
            showOverlay ? this.overlay.show() : this.overlay.hide();
        }
    }

    _updatePosition() {
        if (!this.overlay || !this.overlayBox) return;
        
        const monitor = Main.layoutManager.primaryMonitor;
        const h = this.settings.get_string('overlay-horizontal-position');
        const v = this.settings.get_string('overlay-vertical-position');
        const xOffset = this.settings.get_int('overlay-x-offset');
        const yOffset = this.settings.get_int('overlay-y-offset');
        const width = this.settings.get_int('overlay-width');
        const height = this.settings.get_int('overlay-height');
        const orientation = this.settings.get_string('overlay-orientation');
        
        const actualWidth = orientation === 'vertical' ? height : width;
        const actualHeight = orientation === 'vertical' ? width : height;
        
        let x = this._calculateHorizontalPosition(h, monitor.width, actualWidth);
        let y = this._calculateVerticalPosition(v, monitor.height, actualHeight);
        
        x = Math.max(0, Math.min(x + xOffset, monitor.width - actualWidth));
        y = Math.max(0, Math.min(y + yOffset, monitor.height - actualHeight));
        
        this.overlay.set_position(x, y);
        this.overlayBox.set_size(actualWidth, actualHeight);
        this.overlayBox.vertical = (orientation === 'vertical');
    }

    _calculateHorizontalPosition(position, monitorWidth, overlayWidth) {
        switch (position) {
            case 'left': return 20;
            case 'right': return monitorWidth - overlayWidth - 20;
            default: return Math.floor((monitorWidth - overlayWidth) / 2);
        }
    }

    _calculateVerticalPosition(position, monitorHeight, overlayHeight) {
        switch (position) {
            case 'top': return 20;
            case 'center': return Math.floor((monitorHeight - overlayHeight) / 2);
            default: return monitorHeight - overlayHeight - 20;
        }
    }

    _updateStyle() {
        if (!this.overlayBox) return;
        
        const opacity = this.settings.get_double('overlay-opacity');
        const theme = this.settings.get_string('overlay-theme');
        
        const colors = this._getThemeColors(theme);
        
        // Apply theme class to box for CSS styling
        this.overlayBox.remove_style_class_name('light-theme');
        this.overlayBox.remove_style_class_name('dark-theme');
        this.overlayBox.add_style_class_name(colors.themeClass);
        
        const style = this._buildBoxStyle(colors, opacity);
        this.overlayBox.set_style(style);
        
        if (this.overlayText) {
            // Apply theme class to text as well
            this.overlayText.remove_style_class_name('light-theme');
            this.overlayText.remove_style_class_name('dark-theme');
            this.overlayText.add_style_class_name(colors.themeClass);
            
            const textStyle = this._buildTextStyle(colors);
            this.overlayText.set_style(textStyle);
        }
    }

    _getThemeColors(theme) {
        if (theme === 'light') {
            return {
                background: 'rgba(248, 249, 250, 0.95)',
                text: '#1a1d20',
                border: 'rgba(0, 0, 0, 0.08)',
                shadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
                textShadow: '0 1px 1px rgba(255, 255, 255, 0.8)',
                themeClass: 'light-theme'
            };
        } else if (theme === 'dark') {
            return {
                background: 'rgba(28, 31, 35, 0.95)',
                text: '#f1f3f4',
                border: 'rgba(255, 255, 255, 0.1)',
                shadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                themeClass: 'dark-theme'
            };
        } else {
            return this._getSystemThemeColors();
        }
    }

    _getSystemThemeColors() {
        try {
            const interfaceSettings = new Gio.Settings({schema: 'org.gnome.desktop.interface'});
            const gtkTheme = interfaceSettings.get_string('gtk-theme');
            const colorScheme = interfaceSettings.get_string('color-scheme');
            const isDark = gtkTheme.toLowerCase().includes('dark') || colorScheme === 'prefer-dark';
            
            if (isDark) {
                return {
                    background: 'rgba(28, 31, 35, 0.95)',
                    text: '#f1f3f4',
                    border: 'rgba(255, 255, 255, 0.1)',
                    shadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                    themeClass: 'dark-theme'
                };
            } else {
                return {
                    background: 'rgba(248, 249, 250, 0.95)',
                    text: '#1a1d20',
                    border: 'rgba(0, 0, 0, 0.08)',
                    shadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
                    textShadow: '0 1px 1px rgba(255, 255, 255, 0.8)',
                    themeClass: 'light-theme'
                };
            }
        } catch (e) {
            return {
                background: 'rgba(28, 31, 35, 0.95)',
                text: '#f1f3f4',
                border: 'rgba(255, 255, 255, 0.1)',
                shadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                themeClass: 'dark-theme'
            };
        }
    }

    _buildBoxStyle(colors, opacity) {
        return `background: ${colors.background}; ` +
               `border: 1px solid ${colors.border}; ` +
               `border-radius: 12px; ` +
               `padding: 20px; ` +
               `box-shadow: ${colors.shadow}; ` +
               `backdrop-filter: blur(20px); ` +
               `-webkit-backdrop-filter: blur(20px);`;
    }

    _buildTextStyle(colors) {
        const fontFamily = this.settings.get_string('overlay-font-family');
        const fontSize = this.settings.get_int('overlay-font-size');
        
        let cssFont = '';
        if (fontFamily !== 'System Default') {
            const fontMap = {
                'Sans Serif': 'font-family: sans-serif; ',
                'Serif': 'font-family: serif; ',
                'Monospace': 'font-family: monospace; '
            };
            cssFont = fontMap[fontFamily] || `font-family: "${fontFamily}"; `;
        }
        
        return `color: ${colors.text}; ` +
               `${cssFont}` +
               `font-size: ${fontSize}px; ` +
               `font-weight: 500; ` +
               `line-height: 1.5; ` +
               `letter-spacing: 0.02em; ` +
               `text-shadow: ${colors.textShadow}; ` +
               `word-wrap: break-word;`;
    }

    updateText(text) {
        if (!this.overlayText) return;
        
        const displayText = text || 'Konuşmaya hazır...\nBuraya tanınan metin görünecek.';
        this.overlayText.text = displayText;
    }

    destroy() {
        if (this.overlay) {
            Main.layoutManager.removeChrome(this.overlay);
            this.overlay.destroy();
            this.overlay = null;
            this.overlayBox = null;
            this.overlayText = null;
        }
    }
}
