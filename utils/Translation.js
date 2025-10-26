import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * Translation utility for GNOME Shell extensions
 * Provides gettext functionality with fallback support
 */
export class Translation {
    constructor(extensionObject) {
        this.extensionObject = extensionObject;
        this.domain = 'stt-extension';
        this._setupTranslation();
    }

    _setupTranslation() {
        // Set up translation domain
        const localeDir = this.extensionObject.path + '/locale';
        
        try {
            // Try to bind the text domain
            imports.gettext.bindtextdomain(this.domain, localeDir);
            imports.gettext.textdomain(this.domain);
            this._translationAvailable = true;
            
            // Get current locale
            this.currentLocale = GLib.get_language_names()[0] || 'en';
            
            console.log(`[STT Extension] Translation initialized for locale: ${this.currentLocale}`);
        } catch (error) {
            console.warn(`[STT Extension] Translation setup failed: ${error.message}`);
            this._translationAvailable = false;
        }
    }

    /**
     * Translate a string using gettext
     * @param {string} message - Message to translate
     * @returns {string} Translated message or original if translation fails
     */
    gettext(message) {
        if (!this._translationAvailable) {
            return message;
        }

        try {
            return imports.gettext.dgettext(this.domain, message) || message;
        } catch (error) {
            console.warn(`[STT Extension] Translation failed for "${message}": ${error.message}`);
            return message;
        }
    }

    /**
     * Translate a string with plural forms
     * @param {string} singular - Singular form
     * @param {string} plural - Plural form  
     * @param {number} n - Number to determine plural
     * @returns {string} Translated message
     */
    ngettext(singular, plural, n) {
        if (!this._translationAvailable) {
            return n === 1 ? singular : plural;
        }

        try {
            return imports.gettext.dngettext(this.domain, singular, plural, n) || (n === 1 ? singular : plural);
        } catch (error) {
            console.warn(`[STT Extension] Plural translation failed: ${error.message}`);
            return n === 1 ? singular : plural;
        }
    }

    /**
     * Get available languages
     * @returns {Array} Array of language codes
     */
    getAvailableLanguages() {
        const localeDir = this.extensionObject.path + '/locale';
        const languages = ['en']; // Default fallback

        try {
            const dir = Gio.File.new_for_path(localeDir);
            if (dir.query_exists(null)) {
                const enumerator = dir.enumerate_children('standard::name,standard::type', 
                    Gio.FileQueryInfoFlags.NONE, null);
                
                let info;
                while ((info = enumerator.next_file(null)) !== null) {
                    if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                        const langCode = info.get_name();
                        if (langCode !== 'en') {
                            languages.push(langCode);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`[STT Extension] Could not scan locale directory: ${error.message}`);
        }

        return languages;
    }

    /**
     * Get current language display name
     * @returns {string} Display name of current language
     */
    getCurrentLanguageDisplayName() {
        const languageNames = {
            'en': 'English',
            'tr': 'Türkçe',
            'de': 'Deutsch',
            'fr': 'Français',
            'es': 'Español',
            'it': 'Italiano',
            'pt': 'Português',
            'ru': 'Русский',
            'zh': '中文',
            'ja': '日本語',
            'ko': '한국어'
        };

        const langCode = this.currentLocale.split('_')[0];
        return languageNames[langCode] || langCode.toUpperCase();
    }

    /**
     * Check if translation is available for current locale
     * @returns {boolean} True if translation is available
     */
    isTranslationAvailable() {
        return this._translationAvailable;
    }

    /**
     * Get translation info for debugging
     * @returns {object} Translation information
     */
    getTranslationInfo() {
        return {
            available: this._translationAvailable,
            domain: this.domain,
            locale: this.currentLocale,
            availableLanguages: this.getAvailableLanguages(),
            currentLanguageDisplay: this.getCurrentLanguageDisplayName()
        };
    }
}

// Global translation instance will be set by extension.js
export let translator = null;

/**
 * Initialize translation system
 * @param {object} extensionObject - Extension object from GNOME Shell
 */
export function initTranslation(extensionObject) {
    translator = new Translation(extensionObject);
    return translator;
}

/**
 * Convenience function for translation
 * @param {string} message - Message to translate
 * @returns {string} Translated message
 */
export function _(message) {
    return translator ? translator.gettext(message) : message;
}

/**
 * Convenience function for plural translation
 * @param {string} singular - Singular form
 * @param {string} plural - Plural form
 * @param {number} n - Number
 * @returns {string} Translated message
 */
export function ngettext(singular, plural, n) {
    return translator ? translator.ngettext(singular, plural, n) : (n === 1 ? singular : plural);
}
