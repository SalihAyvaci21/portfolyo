const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const app = express();
// Render'ın atadığı portu kullanır (Genellikle 10000), eğer atanmamışsa 3000 kullanır.
const port = process.env.PORT || 3000;

// ==========================================
// Middleware (Ara Katman Yazılımları)
// ==========================================

// CORS'u etkinleştirir: Bu, farklı bir alan adından (sizin GitHub Pages adresiniz) gelen isteklere izin verir.
app.use(cors());

// Gelen JSON isteklerinin gövdesini ayrıştırmak için kullanılır.
app.use(bodyParser.json());

// ==========================================
// Konfigürasyon ve Yol Tanımları
// ==========================================

// Geçici sketch dosyasının tutulacağı dizin
const sketchDir = path.join(__dirname, 'sketch');

// Derleme sonrası beklenen .hex dosyasının yolu
// Not: Bu yol, Dockerfile'da ve compile komutunda kullanılan build yolu ve hedef karta bağlıdır.
// (arduino:avr:uno için varsayılan çıktı yoludur)
const hexPath = path.join(sketchDir, 'build/arduino.avr.uno/sketch.ino.hex');


// ==========================================
// Derleme Endpoint'i
// ==========================================
app.post('/compile', async (req, res) => {
    // Kullanıcının gönderdiği C++ kodunu alır
    const code = req.body.code;

    if (!code) {
        return res.status(400).send({ error: 'Code not provided.' });
    }

    // Sketch dosyasının tam yolu
    const sketchFile = path.join(sketchDir, 'sketch.ino');
    let derlemeHatasi = null;

    try {
        // 1. Önceki dizinleri ve derleme çıktılarını temizle
        await fs.rm(sketchDir, { recursive: true, force: true });
        await fs.mkdir(sketchDir, { recursive: true });
        
        // 2. Kodu sketch.ino dosyasına yaz
        await fs.writeFile(sketchFile, code);

        // 3. Arduino CLI ile derleme komutu
        // -b arduino:avr:uno: Arduino Uno kartını seçer
        // --build-path: Çıktı klasörünü belirtir.
        const compileCommand = `arduino-cli compile -b arduino:avr:uno ${sketchDir} --build-path ${path.join(sketchDir, 'build')}`;
        
        
        // exec fonksiyonunu bir Promise'e sararak asenkron çalışmayı bekliyoruz
        await new Promise((resolve, reject) => {
            exec(compileCommand, (error, stdout, stderr) => {
                if (error) {
                    // Derleme hatasını yakala ve reddet
                    derlemeHatasi = stderr || 'Bilinmeyen derleme hatası.';
                    console.error(`Derleme Hatası: ${derlemeHatasi}`);
                    reject(new Error("Derleme başarısız.")); 
                } else {
                    // Başarılı derlemeden sonra devam et
                    console.log("Derleme başarılı. Çıktı: ", stdout.substring(0, 100) + "...");
                    resolve();
                }
            });
        });

        // 4. Derlenen .hex dosyasını oku ve gönder
        const hexContent = await fs.readFile(hexPath, 'utf8');
        return res.send({ hex: hexContent });

    } catch (hata) {
        // Hata yakalanırsa (Dosya sistemi hatası veya derleme hatası)
        
        if (hata.message === "Derleme başarısız.") {
            // Arduino CLI'dan gelen hatayı gönder
            return res.status(500).send({ 
                error: 'Compilation failed', 
                details: derlemeHatasi || 'Derleme çıktısı alınamadı.'
            });
        }
        
        // Genel dosya sistemi/işlem hatasını gönder
        console.error(`Genel Hata: ${hata.message}`);
        return res.status(500).send({ 
            error: 'Sunucu İç Hatası', 
            details: hata.message 
        });
    }
});


// ==========================================
// Sunucuyu Başlat
// ==========================================
app.listen(port, () => {
    console.log(`Arduino CLI Compilation Server listening on port ${port}`);
    console.log(`CORS aktif. Frontend erişimi sağlanmalı.`);
});

// GET isteği için basit bir yanıt (Sunucunun çalışıp çalışmadığını kontrol etmek için)
app.get('/', (req, res) => {
    res.send('Arduino CLI Derleme Sunucusu aktif. Derleme için POST /compile adresini kullanın.');
});
