import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class STTPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Set window properties
        window.set_default_size(800, 700);
        window.set_title('Speech to Text - Advanced Settings');
        
        const settings = this.getSettings();

        // Create main pages
        this._createGeneralPage(window, settings);
        this._createModelPage(window, settings); 
        this._createTranslationPage(window, settings);
        this._createOverlayPage(window, settings);
        this._createAdvancedPage(window, settings);
    }

    _createGeneralPage(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic'
        });
        window.add(page);

        // General Settings Group
        const generalGroup = new Adw.PreferencesGroup({
            title: _('General Settings'),
            description: _('Basic speech recognition and behavior settings')
        });
        page.add(generalGroup);

        // Auto-record switch
        const autoRecordRow = new Adw.SwitchRow({
            title: _('Auto Record'),
            subtitle: _('Automatically start recording when extension is activated')
        });
        settings.bind('auto-record', autoRecordRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(autoRecordRow);

        // Auto-copy switch
        const autoCopyRow = new Adw.SwitchRow({
            title: _('Auto Copy to Clipboard'),
            subtitle: _('Automatically copy recognized text to clipboard')
        });
        settings.bind('auto-copy', autoCopyRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(autoCopyRow);

        // Auto-clear switch
        const autoClearRow = new Adw.SwitchRow({
            title: _('Auto Clear'),
            subtitle: _('Automatically clear text after copying')
        });
        settings.bind('auto-clear', autoClearRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(autoClearRow);

        // Audio Settings Group
        const audioGroup = new Adw.PreferencesGroup({
            title: _('Audio Settings'),
            description: _('Microphone and audio processing settings')
        });
        page.add(audioGroup);

        // Microphone sensitivity
        const sensitivityRow = new Adw.SpinRow({
            title: _('Microphone Sensitivity'),
            subtitle: _('Microphone sensitivity level (0-100)'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 5,
                value: settings.get_int('microphone-sensitivity')
            })
        });
        settings.bind('microphone-sensitivity', sensitivityRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        audioGroup.add(sensitivityRow);

        // Noise reduction
        const noiseReductionRow = new Adw.SwitchRow({
            title: _('Noise Reduction'),
            subtitle: _('Enable noise reduction for better recognition')
        });
        settings.bind('noise-reduction', noiseReductionRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        audioGroup.add(noiseReductionRow);
    }

    _createModelPage(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('Models'),
            icon_name: 'folder-symbolic'
        });
        window.add(page);

        // Current Model Group
        const currentModelGroup = new Adw.PreferencesGroup({
            title: _('Current Speech Recognition Model'),
            description: _('Select and configure the active Vosk model')
        });
        page.add(currentModelGroup);

        // Current model path
        const currentModelRow = new Adw.ActionRow({
            title: _('Current Model'),
            subtitle: settings.get_string('current-model-path') || _('No model selected')
        });
        
        const selectModelButton = new Gtk.Button({
            label: _('Select Model'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action']
        });
        
        selectModelButton.connect('clicked', () => {
            this._showModelSelector(window, settings, currentModelRow);
        });
        
        currentModelRow.add_suffix(selectModelButton);
        currentModelGroup.add(currentModelRow);

        // Model info display
        const modelLanguageRow = new Adw.ActionRow({
            title: _('Model Language'),
            subtitle: settings.get_string('model-language') || _('Unknown')
        });
        currentModelGroup.add(modelLanguageRow);

        const modelQualityRow = new Adw.ActionRow({
            title: _('Model Quality'),
            subtitle: settings.get_string('model-quality') || _('Unknown')
        });
        currentModelGroup.add(modelQualityRow);

        // Model Management Group
        const modelManagementGroup = new Adw.PreferencesGroup({
            title: _('Model Management'),
            description: _('Add, remove, and manage speech recognition models')
        });
        page.add(modelManagementGroup);

        // Auto-detect models
        const autoDetectRow = new Adw.SwitchRow({
            title: _('Auto-detect Models'),
            subtitle: _('Automatically scan for Vosk models in common directories')
        });
        settings.bind('auto-detect-models', autoDetectRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        modelManagementGroup.add(autoDetectRow);

        // Scan for models button
        const scanModelsRow = new Adw.ActionRow({
            title: _('Scan for Models'),
            subtitle: _('Search for new Vosk models in your system')
        });
        
        const scanButton = new Gtk.Button({
            label: _('Scan Now'),
            valign: Gtk.Align.CENTER
        });
        
        scanButton.connect('clicked', () => {
            this._scanForModels(settings, scanButton);
        });
        
        scanModelsRow.add_suffix(scanButton);
        modelManagementGroup.add(scanModelsRow);

        // Add model manually
        const addModelRow = new Adw.ActionRow({
            title: _('Add Model Manually'),
            subtitle: _('Browse and add a Vosk model from a specific location')
        });
        
        const addButton = new Gtk.Button({
            label: _('Browse'),
            valign: Gtk.Align.CENTER
        });
        
        addButton.connect('clicked', () => {
            this._browseForModel(window, settings);
        });
        
        addModelRow.add_suffix(addButton);
        modelManagementGroup.add(addModelRow);

        // Update model info when settings change
        settings.connect('changed::current-model-path', () => {
            currentModelRow.set_subtitle(settings.get_string('current-model-path') || _('No model selected'));
        });
        
        settings.connect('changed::model-language', () => {
            modelLanguageRow.set_subtitle(settings.get_string('model-language') || _('Unknown'));
        });
        
        settings.connect('changed::model-quality', () => {
            modelQualityRow.set_subtitle(settings.get_string('model-quality') || _('Unknown'));
        });
    }

    _createTranslationPage(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('Translation'),
            icon_name: 'applications-internet-symbolic'
        });
        window.add(page);

        // Translation Settings Group
        const translationGroup = new Adw.PreferencesGroup({
            title: _('Translation Settings'),
            description: _('Configure automatic translation of recognized text')
        });
        page.add(translationGroup);

        // Enable translation
        const enableTranslationRow = new Adw.SwitchRow({
            title: _('Enable Translation'),
            subtitle: _('Automatically translate recognized text')
        });
        settings.bind('enable-translation', enableTranslationRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        translationGroup.add(enableTranslationRow);

        // Auto translate
        const autoTranslateRow = new Adw.SwitchRow({
            title: _('Auto Translate'),
            subtitle: _('Translate text immediately after recognition')
        });
        settings.bind('auto-translate', autoTranslateRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        translationGroup.add(autoTranslateRow);

        // Show original text
        const showOriginalRow = new Adw.SwitchRow({
            title: _('Show Original Text'),
            subtitle: _('Display both original and translated text')
        });
        settings.bind('show-original-text', showOriginalRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        translationGroup.add(showOriginalRow);

        // Translation Service Group
        const serviceGroup = new Adw.PreferencesGroup({
            title: _('Translation Service'),
            description: _('Choose your preferred translation provider')
        });
        page.add(serviceGroup);

        // Translation service selection
        const serviceRow = new Adw.ComboRow({
            title: _('Translation Service'),
            subtitle: _('Select translation service provider')
        });
        const serviceModel = new Gtk.StringList();
        ['Google Translate', 'LibreTranslate', 'Offline (Future)'].forEach(option => serviceModel.append(option));
        serviceRow.set_model(serviceModel);
        
        const currentService = settings.get_string('translation-service');
        const serviceIndex = ['google', 'libretranslate', 'offline'].indexOf(currentService);
        serviceRow.set_selected(serviceIndex >= 0 ? serviceIndex : 0);
        
        serviceRow.connect('notify::selected', () => {
            const services = ['google', 'libretranslate', 'offline'];
            settings.set_string('translation-service', services[serviceRow.get_selected()]);
        });
        serviceGroup.add(serviceRow);

        // Language Settings Group
        const languageGroup = new Adw.PreferencesGroup({
            title: _('Language Settings'),
            description: _('Configure source and target languages')
        });
        page.add(languageGroup);

        // Source language
        const sourceLanguageRow = new Adw.ComboRow({
            title: _('Source Language'),
            subtitle: _('Language of the original text')
        });
        const sourceModel = this._createLanguageModel();
        sourceLanguageRow.set_model(sourceModel);
        this._setLanguageSelection(sourceLanguageRow, settings.get_string('translation-source-language'));
        
        sourceLanguageRow.connect('notify::selected', () => {
            const languages = this._getLanguageCodes();
            settings.set_string('translation-source-language', languages[sourceLanguageRow.get_selected()]);
        });
        languageGroup.add(sourceLanguageRow);

        // Target language
        const targetLanguageRow = new Adw.ComboRow({
            title: _('Target Language'),
            subtitle: _('Language to translate to')
        });
        const targetModel = this._createLanguageModel();
        targetLanguageRow.set_model(targetModel);
        this._setLanguageSelection(targetLanguageRow, settings.get_string('translation-target-language'));
        
        targetLanguageRow.connect('notify::selected', () => {
            const languages = this._getLanguageCodes();
            settings.set_string('translation-target-language', languages[targetLanguageRow.get_selected()]);
        });
        languageGroup.add(targetLanguageRow);

        // Service Configuration Group
        const configGroup = new Adw.PreferencesGroup({
            title: _('Service Configuration'),
            description: _('Configure specific translation service settings')
        });
        page.add(configGroup);

        // Google API Key
        const googleApiKeyRow = new Adw.PasswordEntryRow({
            title: _('Google Translate API Key'),
            text: settings.get_string('google-translate-api-key')
        });
        googleApiKeyRow.connect('changed', () => {
            settings.set_string('google-translate-api-key', googleApiKeyRow.get_text());
        });
        configGroup.add(googleApiKeyRow);

        // LibreTranslate URL
        const libreTranslateUrlRow = new Adw.EntryRow({
            title: _('LibreTranslate URL'),
            text: settings.get_string('libretranslate-url')
        });
        libreTranslateUrlRow.connect('changed', () => {
            settings.set_string('libretranslate-url', libreTranslateUrlRow.get_text());
        });
        configGroup.add(libreTranslateUrlRow);

        // Test translation
        const testRow = new Adw.ActionRow({
            title: _('Test Translation'),
            subtitle: _('Test your translation service configuration')
        });
        
        const testButton = new Gtk.Button({
            label: _('Test Now'),
            valign: Gtk.Align.CENTER
        });
        
        testButton.connect('clicked', () => {
            this._testTranslationService(testButton);
        });
        
        testRow.add_suffix(testButton);
        configGroup.add(testRow);
    }

    _createOverlayPage(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('Overlay'),
            icon_name: 'view-fullscreen-symbolic'
        });
        window.add(page);

        // Display Settings Group
        const displayGroup = new Adw.PreferencesGroup({
            title: _('Display Settings'),
            description: _('Configure the screen overlay appearance')
        });
        page.add(displayGroup);

        // Show overlay switch
        const showOverlayRow = new Adw.SwitchRow({
            title: _('Show Screen Overlay'),
            subtitle: _('Display status information on screen')
        });
        settings.bind('show-overlay', showOverlayRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(showOverlayRow);

        // Position Settings Group  
        const positionGroup = new Adw.PreferencesGroup({
            title: _('Position Settings'),
            description: _('Configure overlay position and size')
        });
        page.add(positionGroup);

        // Horizontal position
        const horizontalPosRow = new Adw.ComboRow({
            title: _('Horizontal Position'),
            subtitle: _('Horizontal position of overlay widget')
        });
        const horizontalModel = new Gtk.StringList();
        ['Left', 'Center', 'Right'].forEach(option => horizontalModel.append(option));
        horizontalPosRow.set_model(horizontalModel);
        
        const currentH = settings.get_string('overlay-horizontal-position');
        const hIndex = ['left', 'center', 'right'].indexOf(currentH);
        horizontalPosRow.set_selected(hIndex >= 0 ? hIndex : 1);
        
        horizontalPosRow.connect('notify::selected', () => {
            const positions = ['left', 'center', 'right'];
            settings.set_string('overlay-horizontal-position', positions[horizontalPosRow.get_selected()]);
        });
        positionGroup.add(horizontalPosRow);

        // Vertical position
        const verticalPosRow = new Adw.ComboRow({
            title: _('Vertical Position'),
            subtitle: _('Vertical position of overlay widget')
        });
        const verticalModel = new Gtk.StringList();
        ['Top', 'Center', 'Bottom'].forEach(option => verticalModel.append(option));
        verticalPosRow.set_model(verticalModel);
        
        const currentV = settings.get_string('overlay-vertical-position');
        const vIndex = ['top', 'center', 'bottom'].indexOf(currentV);
        verticalPosRow.set_selected(vIndex >= 0 ? vIndex : 2);
        
        verticalPosRow.connect('notify::selected', () => {
            const positions = ['top', 'center', 'bottom'];
            settings.set_string('overlay-vertical-position', positions[verticalPosRow.get_selected()]);
        });
        positionGroup.add(verticalPosRow);

        // Width
        const widthRow = new Adw.SpinRow({
            title: _('Width'),
            subtitle: _('Overlay width in pixels (100-1000)'),
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 1000,
                step_increment: 10,
                value: settings.get_int('overlay-width')
            })
        });
        settings.bind('overlay-width', widthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        positionGroup.add(widthRow);

        // Height
        const heightRow = new Adw.SpinRow({
            title: _('Height'),
            subtitle: _('Overlay height in pixels (100-1000)'),
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 1000,
                step_increment: 5,
                value: settings.get_int('overlay-height')
            })
        });
        settings.bind('overlay-height', heightRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        positionGroup.add(heightRow);

        // Appearance Settings Group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance Settings'),
            description: _('Customize overlay visual appearance')
        });
        page.add(appearanceGroup);

        // Theme
        const themeRow = new Adw.ComboRow({
            title: _('Theme'),
            subtitle: _('Overlay color theme')
        });
        const themeModel = new Gtk.StringList();
        ['System Theme', 'Light Theme', 'Dark Theme'].forEach(option => themeModel.append(option));
        themeRow.set_model(themeModel);
        
        const currentTheme = settings.get_string('overlay-theme');
        const themeIndex = ['system', 'light', 'dark'].indexOf(currentTheme);
        themeRow.set_selected(themeIndex >= 0 ? themeIndex : 0);
        
        themeRow.connect('notify::selected', () => {
            const themes = ['system', 'light', 'dark'];
            settings.set_string('overlay-theme', themes[themeRow.get_selected()]);
        });
        appearanceGroup.add(themeRow);

        // Opacity
        const opacityRow = new Adw.SpinRow({
            title: _('Opacity'),
            subtitle: _('Overlay transparency level'),
            adjustment: new Gtk.Adjustment({
                lower: 0.1,
                upper: 1.0,
                step_increment: 0.1,
                value: settings.get_double('overlay-opacity')
            }),
            digits: 1
        });
        settings.bind('overlay-opacity', opacityRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(opacityRow);

        // Font size
        const fontSizeRow = new Adw.SpinRow({
            title: _('Font Size'),
            subtitle: _('Text font size in pixels (10-32)'),
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 32,
                step_increment: 1,
                value: settings.get_int('overlay-font-size')
            })
        });
        settings.bind('overlay-font-size', fontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(fontSizeRow);
    }

    _createAdvancedPage(window, settings) {
        const page = new Adw.PreferencesPage({
            title: _('Advanced'),
            icon_name: 'preferences-other-symbolic'
        });
        window.add(page);

        // Performance Settings Group
        const performanceGroup = new Adw.PreferencesGroup({
            title: _('Performance Settings'),
            description: _('Advanced performance and debugging options')
        });
        page.add(performanceGroup);

        // About Group
        const aboutGroup = new Adw.PreferencesGroup({
            title: _('About'),
            description: _('Extension information and credits')
        });
        page.add(aboutGroup);

        const aboutRow = new Adw.ActionRow({
            title: _('Speech to Text Extension'),
            subtitle: _('Advanced speech recognition with translation support\nVersion 2.0 - Performance Optimized')
        });
        aboutGroup.add(aboutRow);

        const creditsRow = new Adw.ActionRow({
            title: _('Credits'),
            subtitle: _('Powered by Vosk speech recognition\nTranslation by Google Translate & LibreTranslate')
        });
        aboutGroup.add(creditsRow);
    }

    // Helper methods for model management
    _showModelSelector(window, settings, currentModelRow) {
        const dialog = new Gtk.FileChooserDialog({
            title: _('Select Vosk Model Directory'),
            transient_for: window,
            modal: true,
            action: Gtk.FileChooserAction.SELECT_FOLDER
        });

        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Select'), Gtk.ResponseType.ACCEPT);

        dialog.connect('response', (dialog, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const file = dialog.get_file();
                const path = file.get_path();
                
                // Validate the selected directory contains a Vosk model
                if (this._validateVoskModel(path)) {
                    settings.set_string('current-model-path', path);
                    this._updateModelInfo(settings, path);
                } else {
                    this._showErrorDialog(window, _('Invalid Model'), 
                        _('The selected directory does not contain a valid Vosk model.'));
                }
            }
            dialog.destroy();
        });

        dialog.show();
    }

    _validateVoskModel(modelPath) {
        try {
            const requiredFiles = ['conf/model.conf', 'am/final.mdl', 'graph/HCLG.fst'];
            
            for (const requiredFile of requiredFiles) {
                const filePath = GLib.build_filenamev([modelPath, requiredFile]);
                const file = Gio.File.new_for_path(filePath);
                if (!file.query_exists(null)) {
                    return false;
                }
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    _updateModelInfo(settings, modelPath) {
        const modelName = GLib.path_get_basename(modelPath);
        
        // Extract language from model name
        let language = 'Unknown';
        if (modelName.includes('en-us')) language = 'English (US)';
        else if (modelName.includes('tr')) language = 'Türkçe';
        else if (modelName.includes('de')) language = 'Deutsch';
        else if (modelName.includes('fr')) language = 'Français';
        
        // Extract quality from model name
        let quality = 'Unknown';
        if (modelName.includes('small')) quality = 'Small (~50MB)';
        else if (modelName.includes('large')) quality = 'Large (~1GB+)';
        else if (modelName.includes('medium')) quality = 'Medium (~200MB)';
        
        settings.set_string('model-language', language);
        settings.set_string('model-quality', quality);
    }

    _scanForModels(settings, button) {
        button.set_label(_('Scanning...'));
        button.set_sensitive(false);
        
        // Simulate model scanning (this would use ModelManager in real implementation)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            button.set_label(_('Scan Now'));
            button.set_sensitive(true);
            return GLib.SOURCE_REMOVE;
        });
    }

    _browseForModel(window, settings) {
        this._showModelSelector(window, settings, null);
    }

    _testTranslationService(button) {
        button.set_label(_('Testing...'));
        button.set_sensitive(false);
        
        // Simulate translation test
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            button.set_label(_('Test Now'));
            button.set_sensitive(true);
            return GLib.SOURCE_REMOVE;
        });
    }

    // Helper methods for language selection
    _createLanguageModel() {
        const model = new Gtk.StringList();
        const languages = ['Auto-detect', 'English', 'Türkçe', 'Deutsch', 'Français', 'Español', 'Русский', '中文'];
        languages.forEach(lang => model.append(lang));
        return model;
    }

    _getLanguageCodes() {
        return ['auto', 'en', 'tr', 'de', 'fr', 'es', 'ru', 'zh'];
    }

    _setLanguageSelection(comboRow, languageCode) {
        const codes = this._getLanguageCodes();
        const index = codes.indexOf(languageCode);
        comboRow.set_selected(index >= 0 ? index : 0);
    }

    _showErrorDialog(parent, title, message) {
        const dialog = new Adw.MessageDialog({
            transient_for: parent,
            modal: true,
            heading: title,
            body: message
        });
        
        dialog.add_response('ok', _('OK'));
        dialog.set_default_response('ok');
        dialog.present();
    }
}