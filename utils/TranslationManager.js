import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

/**
 * Advanced translation system supporting multiple translation services
 */
export class TranslationManager {
    constructor(settings) {
        this.settings = settings;
        this.session = new Soup.Session();
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
        
        // Language code mappings
        this.languageCodes = {
            'auto': 'Auto-detect',
            'en': 'English',
            'tr': 'Türkçe',
            'de': 'Deutsch',
            'fr': 'Français',
            'es': 'Español',
            'it': 'Italiano',
            'pt': 'Português',
            'ru': 'Русский',
            'ar': 'العربية',
            'zh': '中文',
            'ja': '日本語',
            'ko': '한국어'
        };
        
        this.supportedServices = {
            'google': 'Google Translate',
            'libretranslate': 'LibreTranslate',
            'offline': 'Offline (Future)'
        };
    }

    /**
     * Translate text using the configured translation service
     */
    async translateText(text, sourceLanguage = null, targetLanguage = null) {
        if (!text || text.trim().length === 0) {
            return { original: text, translated: text, service: 'none' };
        }
        
        const service = this.settings.get_string('translation-service');
        const source = sourceLanguage || this.settings.get_string('translation-source-language');
        const target = targetLanguage || this.settings.get_string('translation-target-language');
        
        // Check cache first
        const cacheKey = `${service}-${source}-${target}-${text}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.result;
            }
            this.cache.delete(cacheKey);
        }
        
        let result;
        try {
            switch (service) {
                case 'google':
                    result = await this._translateWithGoogle(text, source, target);
                    break;
                case 'libretranslate':
                    result = await this._translateWithLibreTranslate(text, source, target);
                    break;
                case 'offline':
                    result = await this._translateOffline(text, source, target);
                    break;
                default:
                    throw new Error(`Unsupported translation service: ${service}`);
            }
            
            // Cache the result
            this.cache.set(cacheKey, {
                result: result,
                timestamp: Date.now()
            });
            
            return result;
        } catch (error) {
            console.log(`Translation error: ${error.message}`);
            return {
                original: text,
                translated: text,
                error: error.message,
                service: service
            };
        }
    }

    /**
     * Translate using Google Translate (free web API)
     */
    async _translateWithGoogle(text, source, target) {
        const apiKey = this.settings.get_string('google-translate-api-key');
        let url;
        
        if (apiKey && apiKey.length > 0) {
            // Use official API if key is provided
            url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
        } else {
            // Use free web interface
            const encodedText = encodeURIComponent(text);
            const sl = source === 'auto' ? 'auto' : source;
            url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${target}&dt=t&q=${encodedText}`;
        }
        
        return new Promise((resolve, reject) => {
            const message = Soup.Message.new('GET', url);
            
            if (apiKey && apiKey.length > 0) {
                // Official API request format
                message.set_request_body_from_bytes(
                    'application/json',
                    new GLib.Bytes(JSON.stringify({
                        q: text,
                        source: source,
                        target: target,
                        format: 'text'
                    }))
                );
                message.set_method('POST');
            }
            
            this.session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const response = session.send_and_read_finish(result);
                    const responseText = new TextDecoder().decode(response.get_data());
                    
                    let translatedText;
                    if (apiKey && apiKey.length > 0) {
                        // Parse official API response
                        const data = JSON.parse(responseText);
                        translatedText = data.data.translations[0].translatedText;
                    } else {
                        // Parse free API response
                        const data = JSON.parse(responseText);
                        translatedText = data[0][0][0];
                    }
                    
                    resolve({
                        original: text,
                        translated: translatedText,
                        detectedLanguage: source,
                        service: 'google'
                    });
                } catch (error) {
                    reject(new Error(`Google Translate API error: ${error.message}`));
                }
            });
        });
    }

    /**
     * Translate using LibreTranslate
     */
    async _translateWithLibreTranslate(text, source, target) {
        const baseUrl = this.settings.get_string('libretranslate-url');
        const url = `${baseUrl}/translate`;
        
        const requestData = {
            q: text,
            source: source === 'auto' ? 'auto' : source,
            target: target,
            format: 'text'
        };
        
        return new Promise((resolve, reject) => {
            const message = Soup.Message.new('POST', url);
            message.set_request_body_from_bytes(
                'application/json',
                new GLib.Bytes(JSON.stringify(requestData))
            );
            
            this.session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const response = session.send_and_read_finish(result);
                    const responseText = new TextDecoder().decode(response.get_data());
                    const data = JSON.parse(responseText);
                    
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    resolve({
                        original: text,
                        translated: data.translatedText,
                        detectedLanguage: data.detectedLanguage || source,
                        service: 'libretranslate'
                    });
                } catch (error) {
                    reject(new Error(`LibreTranslate error: ${error.message}`));
                }
            });
        });
    }

    /**
     * Offline translation (placeholder for future implementation)
     */
    async _translateOffline(text, source, target) {
        // This would use local translation models in the future
        throw new Error('Offline translation not yet implemented. Please use Google or LibreTranslate.');
    }

    /**
     * Get available language codes
     */
    getAvailableLanguages() {
        return this.languageCodes;
    }

    /**
     * Get supported translation services
     */
    getSupportedServices() {
        return this.supportedServices;
    }

    /**
     * Detect language of text (using Google's detection)
     */
    async detectLanguage(text) {
        if (!text || text.trim().length === 0) {
            return 'auto';
        }
        
        try {
            const result = await this._translateWithGoogle(text, 'auto', 'en');
            return result.detectedLanguage || 'auto';
        } catch (error) {
            console.log(`Language detection error: ${error.message}`);
            return 'auto';
        }
    }

    /**
     * Test connection to translation service
     */
    async testService(serviceName = null) {
        const service = serviceName || this.settings.get_string('translation-service');
        const testText = 'Hello, world!';
        
        try {
            const result = await this.translateText(testText, 'en', 'tr');
            return {
                success: true,
                service: service,
                testResult: result
            };
        } catch (error) {
            return {
                success: false,
                service: service,
                error: error.message
            };
        }
    }

    /**
     * Clear translation cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;
        
        for (const [key, value] of this.cache) {
            if (now - value.timestamp < this.cacheTimeout) {
                validEntries++;
            } else {
                expiredEntries++;
            }
        }
        
        return {
            total: this.cache.size,
            valid: validEntries,
            expired: expiredEntries
        };
    }

    /**
     * Format translation result for display
     */
    formatTranslationForDisplay(translationResult, showOriginal = true) {
        if (!translationResult || translationResult.error) {
            return translationResult?.original || 'Translation failed';
        }
        
        if (showOriginal && translationResult.original !== translationResult.translated) {
            return `🔊 ${translationResult.original}\n\n🌐 ${translationResult.translated}`;
        }
        
        return translationResult.translated;
    }

    /**
     * Get quick translation pairs for common use cases
     */
    getQuickTranslationPairs() {
        return [
            { source: 'en', target: 'tr', name: 'English → Türkçe' },
            { source: 'tr', target: 'en', name: 'Türkçe → English' },
            { source: 'auto', target: 'tr', name: 'Auto → Türkçe' },
            { source: 'auto', target: 'en', name: 'Auto → English' },
            { source: 'de', target: 'tr', name: 'Deutsch → Türkçe' },
            { source: 'fr', target: 'tr', name: 'Français → Türkçe' }
        ];
    }
}