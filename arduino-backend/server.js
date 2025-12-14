const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const app = express();
// Render ortam portunu kullan
const port = process.env.PORT || 3000;

// ==========================================
// Middleware (CORS dahil)
// ==========================================
app.use(cors()); // CORS aktif: Farklı kaynaklardan gelen isteklere izin verir (GitHub Pages'ten Render'a)
app.use(bodyParser.json());

// ==========================================
// Konfigürasyon
// ==========================================
const sketchDir = path.join(__dirname, 'sketch');
// Arduino Uno (arduino:avr:uno) kartı için beklenen HEX dosya yolu
const hexPath = path.join(sketchDir, 'build/arduino.avr.uno/sketch.ino.hex');


// ==========================================
// Derleme Endpoint'i
// ==========================================
app.post('/compile', async (req, res) => {
    const code = req.body.code;

    if (!code) {
        return res.status(400).send({ error: 'Code not provided.' });
    }

    const sketchFile = path.join(sketchDir, 'sketch.ino');
    let derlemeHatasi = null;

    try {
        // 1. Dizinleri temizle ve oluştur
        await fs.rm(sketchDir, { recursive: true, force: true });
        await fs.mkdir(sketchDir, { recursive: true });
        
        // 2. Kodu sketch.ino dosyasına yaz
        await fs.writeFile(sketchFile, code);

        // 3. Arduino CLI ile derleme komutu
        const compileCommand = `arduino-cli compile -b arduino:avr:uno ${sketchDir} --build-path ${path.join(sketchDir, 'build')}`;
        
        // Komutun tamamlanmasını bekler
        await new Promise((resolve, reject) => {
            exec(compileCommand, (error, stdout, stderr) => {
                if (error) {
                    derlemeHatasi = stderr || 'Bilinmeyen derleme hatası.';
                    console.error(`Derleme Hatası: ${derlemeHatasi}`);
                    reject(new Error("Derleme başarısız.")); 
                } else {
                    console.log("Derleme başarılı.");
                    resolve();
                }
            });
        });

        // 4. Derlenen .hex dosyasını oku ve gönder
        const hexContent = await fs.readFile(hexPath, 'utf8');
        return res.send({ hex: hexContent });

    } catch (hata) {
        
        if (hata.message === "Derleme başarısız.") {
            // Arduino CLI'dan gelen hatayı ön yüze gönder
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
});

// GET isteği (Servis sağlık kontrolü için)
app.get('/', (req, res) => {
    res.send('Arduino CLI Derleme Sunucusu aktif. Derleme için POST /compile adresini kullanın.');
});
