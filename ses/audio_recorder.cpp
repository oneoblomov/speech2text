#include <iostream>
#include <cstdio>
#include <string>
#include <vector>
#include <fstream>
#include <signal.h>
#include <ctime>
#include <cstdint>
#include "vosk-linux-x86_64-0.3.45/vosk_api.h"

class AudioRecorder {
private:
    bool running = true;
    std::vector<int16_t> audioData;
    VoskModel *model = nullptr;
    VoskRecognizer *rec = nullptr;
    std::string accumulatedText = "";
    
    const std::string MODEL_PATH = "/home/kaplan/Documents/vosk-model-small-en-us-0.15";  // Default fallback
    const std::string OUTPUT_TEXT_FILE = "recognized_text.txt";
    const std::string AUDIO_LEVEL_FILE = "audio_level.txt";
    const std::string MODEL_CONFIG_FILE = "current_model.txt";

public:
    AudioRecorder() = default;
    
    ~AudioRecorder() {
        cleanup();
    }
    
    bool initialize() {
        vosk_set_log_level(-1);
        
        // Try to read current model path from config file
        std::string modelPath = readCurrentModelPath();
        if (modelPath.empty()) {
            modelPath = MODEL_PATH;  // Use default
        }
        
        model = vosk_model_new(modelPath.c_str());
        if (!model) {
            std::cerr << "❌ Vosk model could not be loaded: " << modelPath << std::endl;
            
            // Try default path as fallback
            if (modelPath != MODEL_PATH) {
                std::cerr << "🔄 Trying default model path..." << std::endl;
                model = vosk_model_new(MODEL_PATH.c_str());
            }
            
            if (!model) {
                std::cerr << "❌ Default model also failed: " << MODEL_PATH << std::endl;
                return false;
            }
        }
        
        std::cout << "✅ Vosk model loaded: " << modelPath << std::endl;
        
        rec = vosk_recognizer_new(model, 16000.0);
        if (!rec) {
            std::cerr << "❌ Vosk recognizer could not be created!" << std::endl;
            vosk_model_free(model);
            return false;
        }
        
        clearFiles();
        return true;
    }
    
    void cleanup() {
        if (rec) {
            vosk_recognizer_free(rec);
            rec = nullptr;
        }
        if (model) {
            vosk_model_free(model);
            model = nullptr;
        }
    }
    
    void clearFiles() {
        accumulatedText = "";
        writeToFile(OUTPUT_TEXT_FILE, "");
        writeToFile(AUDIO_LEVEL_FILE, "0");
    }
    
    void writeToFile(const std::string& filename, const std::string& content) {
        std::ofstream file(filename, std::ios::out | std::ios::trunc);
        if (file.is_open()) {
            file << content << std::endl;
            file.close();
        }
    }
    
    void writePartialText(const std::string& text) {
        if (text.empty()) return;
        writeToFile(OUTPUT_TEXT_FILE, text);
    }
    
    void writeRecognizedText(const std::string& text) {
        if (text.empty()) return;
        
        if (!accumulatedText.empty()) {
            accumulatedText += " ";
        }
        accumulatedText += text;
        writeToFile(OUTPUT_TEXT_FILE, accumulatedText);
    }
    
    void writeAudioLevel(int level) {
        writeToFile(AUDIO_LEVEL_FILE, std::to_string(level));
    }
    
    std::string readCurrentModelPath() {
        std::ifstream configFile(MODEL_CONFIG_FILE);
        if (configFile.is_open()) {
            std::string modelPath;
            std::getline(configFile, modelPath);
            configFile.close();
            
            // Validate that the model path exists and is valid
            if (!modelPath.empty()) {
                std::ifstream testFile(modelPath + "/conf/model.conf");
                if (testFile.good()) {
                    testFile.close();
                    return modelPath;
                }
            }
        }
        return "";  // Return empty string if no valid path found
    }
    
    void writeCurrentModelPath(const std::string& modelPath) {
        writeToFile(MODEL_CONFIG_FILE, modelPath);
    }
    
    std::string extractTextFromJson(const std::string& jsonStr) {
        size_t textPos = jsonStr.find("\"text\"");
        if (textPos == std::string::npos) return "";
        
        size_t colonPos = jsonStr.find(":", textPos);
        if (colonPos == std::string::npos) return "";
        
        size_t startQuote = jsonStr.find("\"", colonPos);
        if (startQuote == std::string::npos) return "";
        
        size_t endQuote = jsonStr.find("\"", startQuote + 1);
        if (endQuote == std::string::npos) return "";
        
        return jsonStr.substr(startQuote + 1, endQuote - startQuote - 1);
    }
    
    int calculateAudioLevel(int16_t* samples, size_t sampleCount) {
        if (sampleCount == 0) return 0;
        
        int32_t sum = 0;
        for (size_t i = 0; i < sampleCount; i++) {
            sum += abs(samples[i]);
        }
        
        double avgLevel = (double)sum / sampleCount;
        int level = (int)(avgLevel / 3276.7);  // 32767 / 10
        return (level > 10) ? 10 : level;
    }
    
    std::string getSystemAudioMonitor() {
        FILE* pipe = popen("pactl info | grep 'Default Sink' | cut -d' ' -f3", "r");
        if (!pipe) return "";
        
        char buffer[256];
        std::string result = "";
        if (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
            result = std::string(buffer);
            if (!result.empty() && result.back() == '\n') {
                result.pop_back();
            }
            result += ".monitor";
        }
        pclose(pipe);
        return result;
    }
    
    void saveWAVFile(const std::string& filename) {
        struct WAVHeader {
            char chunkID[4] = {'R', 'I', 'F', 'F'};
            uint32_t chunkSize;
            char format[4] = {'W', 'A', 'V', 'E'};
            char subchunk1ID[4] = {'f', 'm', 't', ' '};
            uint32_t subchunk1Size = 16;
            uint16_t audioFormat = 1;
            uint16_t numChannels = 1;
            uint32_t sampleRate = 16000;
            uint32_t byteRate = 32000;
            uint16_t blockAlign = 2;
            uint16_t bitsPerSample = 16;
            char subchunk2ID[4] = {'d', 'a', 't', 'a'};
            uint32_t subchunk2Size;
        };
        
        std::ofstream file(filename, std::ios::binary);
        if (!file) {
            std::cerr << "❌ Could not create WAV file: " << filename << std::endl;
            return;
        }
        
        WAVHeader header;
        header.subchunk2Size = audioData.size() * sizeof(int16_t);
        header.chunkSize = 36 + header.subchunk2Size;
        
        file.write(reinterpret_cast<const char*>(&header), sizeof(header));
        file.write(reinterpret_cast<const char*>(audioData.data()), header.subchunk2Size);
        file.close();
    }
    
    void setSignalHandler() {
        signal(SIGINT, [](int signal) {
            static AudioRecorder* instance = nullptr;
            if (instance) {
                instance->running = false;
            }
        });
        signal(SIGTERM, [](int signal) {
            static AudioRecorder* instance = nullptr;
            if (instance) {
                instance->running = false;
            }
        });
    }
    
    bool record(int mode) {
        std::string command;
        std::string sourceType;
        std::string outputFilename;
        
        time_t now = time(0);
        char timestamp[100];
        strftime(timestamp, sizeof(timestamp), "%Y%m%d_%H%M%S", localtime(&now));
        
        if (mode == 1) {
            command = "parec --format=s16le --rate=16000 --channels=1 --latency-msec=50";
            sourceType = "Mikrofon";
            outputFilename = std::string("mikrofon_") + timestamp + ".wav";
        } else if (mode == 2) {
            std::string monitor = getSystemAudioMonitor();
            if (monitor.empty()) {
                std::cerr << "❌ System audio monitor not found!" << std::endl;
                return false;
            }
            command = "parec --format=s16le --rate=16000 --channels=1 --latency-msec=50 --device=" + monitor;
            sourceType = "System audio";
            outputFilename = std::string("sistem_sesi_") + timestamp + ".wav";
        } else {
            std::cerr << "❌ Invalid recording mode!" << std::endl;
            return false;
        }
        
        std::cout << "\n🎤 " << sourceType << " recording starting..." << std::endl;
        std::cout << "Press Ctrl+C to stop" << std::endl;
        
        FILE* pipe = popen(command.c_str(), "r");
        if (!pipe) {
            std::cerr << "❌ Could not start audio capture!" << std::endl;
            return false;
        }
        
        char buffer[320];   // 0.02 second buffer - ultra-fast response
        size_t totalBytes = 0;
        time_t startTime = time(nullptr);
        int updateCounter = 0;
        std::vector<int16_t> chunkBuffer;
        chunkBuffer.reserve(800); // Pre-allocate for better performance
        
        while (running) {
            size_t bytesRead = fread(buffer, 1, sizeof(buffer), pipe);
            if (bytesRead == 0) break;
            
            if (bytesRead % 2 != 0) {
                bytesRead--;
            }
            
            totalBytes += bytesRead;
            int16_t* samples = (int16_t*)buffer;
            size_t sampleCount = bytesRead / 2;
            
            // Store audio data in chunks for better memory management
            for (size_t i = 0; i < sampleCount; i++) {
                chunkBuffer.push_back(samples[i]);
                audioData.push_back(samples[i]);
            }
            
            // More frequent audio level updates for real-time feedback
            updateCounter++;
            if (updateCounter % 2 == 0) { // Update every 2 chunks (~80ms)
                int level = calculateAudioLevel(samples, sampleCount);
                writeAudioLevel(level);
            }
            
            // Immediate speech recognition processing
            if (rec) {
                // Always get partial result for real-time updates
                const char* partialResult = vosk_recognizer_partial_result(rec);
                std::string partialText = extractTextFromJson(std::string(partialResult));
                if (!partialText.empty()) {
                    writePartialText(partialText);
                }
                
                // Check for final result
                if (vosk_recognizer_accept_waveform(rec, buffer, bytesRead)) {
                    const char* result = vosk_recognizer_result(rec);
                    std::string text = extractTextFromJson(std::string(result));
                    if (!text.empty()) {
                        std::cout << "\n🔊 " << text << std::endl;
                        writeRecognizedText(text);
                    }
                }
            }
            
            // Periodic status (less frequent to reduce overhead)
            if (updateCounter % 25 == 0) { // Every ~1 second
                int elapsedSeconds = time(nullptr) - startTime;
                std::cout << "\r🔴 " << elapsedSeconds << "s [";
                int level = calculateAudioLevel(samples, sampleCount);
                for (int i = 0; i < 10; i++) {
                    std::cout << (i < level ? "=" : " ");
                }
                std::cout << "] " << (totalBytes/1024) << "KB" << std::flush;
            }
        }
        
        pclose(pipe);
        
        // Final recognition
        if (rec) {
            const char* finalResult = vosk_recognizer_final_result(rec);
            std::string text = extractTextFromJson(std::string(finalResult));
            if (!text.empty()) {
                std::cout << "\n🔊 " << text << std::endl;
                writeRecognizedText(text);
            }
        }
        
        // Save audio file
        if (!audioData.empty()) {
            std::cout << "\n💾 Saving: " << outputFilename << std::endl;
            saveWAVFile(outputFilename);
            std::cout << "✅ Completed!" << std::endl;
        }
        
        writeAudioLevel(0);
        return true;
    }
};

int main() {
    AudioRecorder recorder;
    
    if (!recorder.initialize()) {
        std::cout << "⚠️ Speech recognition disabled due to model loading failure." << std::endl;
    } else {
        std::cout << "✓ Speech recognition enabled." << std::endl;
    }
    
    std::cout << "\n🎤 Select Recording Mode:" << std::endl;
    std::cout << "1) Microphone" << std::endl;
    std::cout << "2) System audio" << std::endl;
    std::cout << "Your choice (1-2): ";
    
    int choice;
    std::cin >> choice;
    
    if (!recorder.record(choice)) {
        return 1;
    }
    
    return 0;
}
