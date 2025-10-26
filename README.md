# GNOME Speech2Text Extension

## Özellikler

- GNOME Shell için konuşmadan metne dönüştürme
- Vosk tabanlı ses tanıma (yerel çalışır, internet gerekmez)
- Çoklu dil desteği (İngilizce, Türkçe vb.)
- Çeviri ve metin gösterimi
- Kolay arayüz ve panel butonu
- Ayarlar ve özelleştirme seçenekleri

## Kurulum

### 1. Bağımlılıkların Kurulumu

- GNOME Shell 3.36+ yüklü olmalıdır.
- Vosk kütüphanesi ve model dosyaları gereklidir.
- Gerekli paketleri yüklemek için terminalde aşağıdaki komutları çalıştırın:

  ```bash
  sudo apt-get install build-essential libglib2.0-dev libgtk-3-dev
  ```

### 2. Vosk Modelinin İndirilmesi

- Vosk modelini [Vosk GitHub](https://alphacephei.com/vosk/models) üzerinden indirin.
- İndirdiğiniz model dosyasını `ses/vosk-linux-x86_64-0.3.45` dizinine çıkarın.
- `libvosk.so` ve `vosk_api.h` dosyalarının bu dizinde olduğundan emin olun.

### 3. Ses Kaydedici Derlemesi

- `ses/audio_recorder.cpp` dosyasını derlemek için terminalde aşağıdaki komutu çalıştırın:

  ```bash
  cd ses
  make
  ```

- Derleme sonrası `audio_recorder` dosyası oluşacaktır.

### 4. Uzantının Kurulumu

- Tüm dosyaları `~/.local/share/gnome-shell/extensions/speech2text@oneoblomov.dev` dizinine kopyalayın.
- GNOME Shell uzantıları uygulamasından veya terminalden uzantıyı etkinleştirin:

  ```bash
  gnome-extensions enable speech2text@oneoblomov.dev
  ```

### 5. GNOME Shell'i Yeniden Başlatma

- Değişikliklerin etkin olması için GNOME Shell'i yeniden başlatın:

  ```bash
  Alt + F2
  r
  Enter
  ```

## Kullanım

- Paneldeki mikrofon butonuna tıklayarak konuşmayı başlatın.
- Tanınan metin otomatik olarak ekranda gösterilir ve recognized_text.txt dosyasına kaydedilir.
- Ayarlar menüsünden dil ve diğer seçenekleri değiştirebilirsiniz.

## Gereksinimler

- GNOME Shell 3.36+
- Vosk kütüphanesi ve model dosyaları
- Gerekirse ek bağımlılıklar: `libvosk.so`, `audio_recorder`

## Katkı ve Lisans

Katkıda bulunmak için pull request gönderebilirsiniz. Lisans bilgisi için metadata.json dosyasına bakınız.

---

Daha fazla detay veya özel bir bölüm eklenmesini istiyorsanız belirtiniz.
