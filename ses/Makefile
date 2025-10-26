CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
VOSK_DIR = ./vosk-linux-x86_64-0.3.45
INCLUDES = -I$(VOSK_DIR)
LDFLAGS = -L$(VOSK_DIR) -Wl,-rpath,$(VOSK_DIR)
LIBS = -lvosk

# Targets
TARGET = audio_recorder
OLD_TARGET = a1
SRC = audio_recorder.cpp
OLD_SRC = a1.cpp

.PHONY: all clean install-deps

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o $@ $< $(LDFLAGS) $(LIBS)

# Backward compatibility
$(OLD_TARGET): $(OLD_SRC)
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o $@ $< $(LDFLAGS) $(LIBS)

clean:
	rm -f $(TARGET) $(OLD_TARGET) *.wav *.txt

install-deps:
	@echo "🔧 Installing required libraries..."
	sudo apt update
	sudo apt install -y build-essential cmake pkg-config pulseaudio-utils
	@echo "✅ Dependencies installed!"

test:
	@echo "🧪 Testing audio recorder..."
	@if [ -f $(TARGET) ]; then \
		echo "✅ Audio recorder binary exists"; \
		ldd $(TARGET) | grep vosk && echo "✅ Vosk library linked" || echo "❌ Vosk library not found"; \
	else \
		echo "❌ Audio recorder binary not found. Run 'make' first."; \
	fi

.PHONY: all clean install-deps test
