import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * Advanced model management for multiple Vosk speech recognition models
 */
export class ModelManager {
    constructor(settings) {
        this.settings = settings;
        this.availableModels = new Map();
        this.currentModel = null;
        this.modelScanPaths = [
            GLib.get_home_dir() + '/Documents',
            GLib.get_home_dir() + '/Downloads', 
            '/usr/share/vosk-models',
            '/opt/vosk-models',
            GLib.get_home_dir() + '/.local/share/vosk-models'
        ];
        
        this._initializeModels();
    }

    /**
     * Initialize and scan for available models
     */
    _initializeModels() {
        if (this.settings.get_boolean('auto-detect-models')) {
            this.scanForModels();
        }
        
        // Load saved models
        const savedModels = this.settings.get_strv('available-models');
        savedModels.forEach(modelPath => {
            this._validateAndAddModel(modelPath);
        });
        
        // Set current model
        const currentPath = this.settings.get_string('current-model-path');
        if (currentPath && this.availableModels.has(currentPath)) {
            this.currentModel = this.availableModels.get(currentPath);
        }
    }

    /**
     * Scan common directories for Vosk models
     */
    scanForModels() {
        const foundModels = [];
        
        this.modelScanPaths.forEach(basePath => {
            try {
                const dir = Gio.File.new_for_path(basePath);
                if (!dir.query_exists(null)) return;
                
                const enumerator = dir.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );
                
                let info;
                while ((info = enumerator.next_file(null)) !== null) {
                    const name = info.get_name();
                    const type = info.get_file_type();
                    
                    if (type === Gio.FileType.DIRECTORY && 
                        (name.startsWith('vosk-model') || name.includes('vosk'))) {
                        const modelPath = GLib.build_filenamev([basePath, name]);
                        
                        if (this._isValidVoskModel(modelPath)) {
                            foundModels.push(modelPath);
                        }
                    }
                }
                
                enumerator.close(null);
            } catch (error) {
                console.log(`Model scan error in ${basePath}: ${error.message}`);
            }
        });
        
        // Add newly found models
        foundModels.forEach(modelPath => {
            this._validateAndAddModel(modelPath);
        });
        
        // Save updated model list
        this._saveAvailableModels();
        
        return foundModels;
    }

    /**
     * Validate and add a model to the available models list
     */
    _validateAndAddModel(modelPath) {
        if (!this._isValidVoskModel(modelPath)) {
            return false;
        }
        
        const modelInfo = this._extractModelInfo(modelPath);
        this.availableModels.set(modelPath, modelInfo);
        return true;
    }

    /**
     * Check if a directory contains a valid Vosk model
     */
    _isValidVoskModel(modelPath) {
        try {
            const modelDir = Gio.File.new_for_path(modelPath);
            if (!modelDir.query_exists(null)) return false;
            
            // Check for required Vosk model files
            const requiredFiles = ['conf/model.conf', 'am/final.mdl', 'graph/HCLG.fst'];
            
            for (const requiredFile of requiredFiles) {
                const file = modelDir.get_child(requiredFile);
                if (!file.query_exists(null)) {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Extract model information from directory structure and config files
     */
    _extractModelInfo(modelPath) {
        const modelName = GLib.path_get_basename(modelPath);
        const modelInfo = {
            path: modelPath,
            name: modelName,
            language: 'unknown',
            quality: 'unknown',
            size: 0,
            description: ''
        };
        
        // Extract language from name patterns
        const languagePatterns = {
            'en-us': 'English (US)',
            'en-gb': 'English (UK)', 
            'tr': 'Türkçe',
            'de': 'Deutsch',
            'fr': 'Français',
            'es': 'Español',
            'ru': 'Русский',
            'zh': '中文'
        };
        
        for (const [code, language] of Object.entries(languagePatterns)) {
            if (modelName.toLowerCase().includes(code)) {
                modelInfo.language = language;
                break;
            }
        }
        
        // Extract quality from name
        if (modelName.includes('small')) {
            modelInfo.quality = 'Small (~50MB)';
        } else if (modelName.includes('large')) {
            modelInfo.quality = 'Large (~1GB+)';
        } else if (modelName.includes('medium')) {
            modelInfo.quality = 'Medium (~200MB)';
        }
        
        // Get directory size
        try {
            const [success, output] = GLib.spawn_command_line_sync(`du -sh "${modelPath}"`);
            if (success) {
                const sizeStr = new TextDecoder().decode(output).split('\t')[0];
                modelInfo.size = sizeStr.trim();
            }
        } catch (error) {
            // Size calculation failed, continue without size info
        }
        
        // Try to read model description from config
        try {
            const confFile = Gio.File.new_for_path(GLib.build_filenamev([modelPath, 'conf', 'model.conf']));
            if (confFile.query_exists(null)) {
                const [success, contents] = confFile.load_contents(null);
                if (success) {
                    const configText = new TextDecoder().decode(contents);
                    // Extract any description or version info from config
                    const lines = configText.split('\n');
                    for (const line of lines) {
                        if (line.includes('name') || line.includes('description')) {
                            modelInfo.description = line.split('=')[1]?.trim() || '';
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            // Config reading failed, continue without description
        }
        
        return modelInfo;
    }

    /**
     * Set the current active model
     */
    setCurrentModel(modelPath) {
        if (!this.availableModels.has(modelPath)) {
            throw new Error(`Model not found: ${modelPath}`);
        }
        
        this.currentModel = this.availableModels.get(modelPath);
        this.settings.set_string('current-model-path', modelPath);
        this.settings.set_string('model-language', this.currentModel.language);
        this.settings.set_string('model-quality', this.currentModel.quality);
        
        return this.currentModel;
    }

    /**
     * Add a model manually by path
     */
    addModel(modelPath) {
        if (this._validateAndAddModel(modelPath)) {
            this._saveAvailableModels();
            return this.availableModels.get(modelPath);
        }
        throw new Error(`Invalid Vosk model: ${modelPath}`);
    }

    /**
     * Remove a model from the available list
     */
    removeModel(modelPath) {
        if (this.availableModels.has(modelPath)) {
            this.availableModels.delete(modelPath);
            this._saveAvailableModels();
            
            // If this was the current model, reset to first available
            if (this.currentModel && this.currentModel.path === modelPath) {
                const firstModel = this.availableModels.values().next().value;
                if (firstModel) {
                    this.setCurrentModel(firstModel.path);
                } else {
                    this.currentModel = null;
                    this.settings.set_string('current-model-path', '');
                }
            }
            return true;
        }
        return false;
    }

    /**
     * Get all available models
     */
    getAvailableModels() {
        return Array.from(this.availableModels.values());
    }

    /**
     * Get current active model
     */
    getCurrentModel() {
        return this.currentModel;
    }

    /**
     * Save available models to settings
     */
    _saveAvailableModels() {
        const modelPaths = Array.from(this.availableModels.keys());
        this.settings.set_strv('available-models', modelPaths);
    }

    /**
     * Download a model from the internet (future enhancement)
     */
    downloadModel(modelUrl, targetPath) {
        // Implementation for downloading models from official Vosk repository
        // This would be implemented in a future version
        throw new Error('Model downloading not yet implemented');
    }

    /**
     * Get model download suggestions
     */
    getModelSuggestions() {
        return [
            {
                name: 'English (US) - Small',
                url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
                size: '40MB',
                description: 'Lightweight English model for basic recognition'
            },
            {
                name: 'Turkish - Small', 
                url: 'https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip',
                size: '45MB',
                description: 'Turkish speech recognition model'
            },
            {
                name: 'English (US) - Large',
                url: 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip',
                size: '1.8GB',
                description: 'High-accuracy English model'
            }
        ];
    }
}