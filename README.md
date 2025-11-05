# GNOME Speech2Text Extension

![CI](https://github.com/oneoblomov/speech2text/workflows/CI/badge.svg)
![Application Screenshot](https://github.com/oneoblomov/speech2text/blob/main/.github/Screenshot.png)

## Features

- Speech-to-text conversion for GNOME Shell
- Vosk-based speech recognition (runs locally, no internet required)
- Multi-language support (English, Turkish, etc.)
- Translation and text display
- Easy interface and panel button
- Settings and customization options

## Installation

### 1. Installing Dependencies

- GNOME Shell 3.36+ must be installed.
- Vosk library and model files are required.
- To install the necessary packages, run the following commands in the terminal:

  ```bash
  sudo apt-get install build-essential libglib2.0-dev libgtk-3-dev
  ```

### 2. Downloading the Vosk Model

- Download the Vosk model from [Vosk GitHub](https://alphacephei.com/vosk/models).
- Extract the downloaded model file into the `ses/vosk-linux-x86_64-0.3.45` directory.
- Ensure that `libvosk.so` and `vosk_api.h` files are in this directory.

### 3. Compiling the Audio Recorder

- To compile the `ses/audio_recorder.cpp` file, run the following command in the terminal:

  ```bash
  cd ses
  make
  ```

- After compilation, the `audio_recorder` file will be created.

### 4. Installing the Extension

- Copy all files to the `~/.local/share/gnome-shell/extensions/speech2text@oneoblomov.dev` directory.
- Enable the extension from the GNOME Shell extensions app or from the terminal:

  ```bash
  gnome-extensions enable speech2text@oneoblomov.dev
  ```

### 5. Restarting GNOME Shell

- To apply the changes, restart GNOME Shell:

  ```bash
  Alt + F2
  r
  Enter
  ```

## Usage

- Click the microphone button in the panel to start speaking.
- Recognized text is automatically displayed on the screen and saved to the recognized_text.txt file.
- You can change the language and other options from the settings menu.

## Requirements

- GNOME Shell 3.36+
- Vosk library and model files
- If necessary, additional dependencies: `libvosk.so`, `audio_recorder`

## Contribution and License

You can contribute by sending pull requests. For license information, see the metadata.json file.

## Development

### Code Quality

This project uses ESLint to check JavaScript code quality:

```bash
# Lint check
npm run lint

# Auto fix
npm run lint:fix
```