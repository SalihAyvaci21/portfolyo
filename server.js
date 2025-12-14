const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Geçici dosya yolu ve klasörü
const sketchDir = path.join(__dirname, 'sketch');
const hexPath = path.join(sketchDir, 'build/arduino.avr.uno/sketch.ino.hex');

// Derleme Endpoint'i
app.post('/compile', async (req, res) => {
    const code = req.body.code;

    if (!code) {
        return res.status(400).send({ error: 'Code not provided.' });
    }

    const sketchFile = path.join(sketchDir, 'sketch.ino');

    try {
        // 1. Sketch dizinini oluştur/temizle
        await fs.rm(sketchDir, { recursive: true, force: true });
        await fs.mkdir(sketchDir, { recursive: true });
        
        // 2. Kodu sketch.ino dosyasına yaz
        await fs.writeFile(sketchFile, code);

        // 3. Arduino CLI ile derle
        // -b arduino:avr:uno: Arduino Uno kartını seçer
        // --build-path './build': Çıktı dosyasını ./sketch/build klasörüne kaydeder
        const compileCommand = `arduino-cli compile -b arduino:avr:uno ${sketchDir} --build-path ${path.join(sketchDir, 'build')}`;
        
        exec(compileCommand, async (error, stdout, stderr) => {
            if (error) {
                console.error(`Derleme Hatası: ${stderr}`);
                return res.status(500).send({ error: 'Compilation failed', details: stderr });
            }
            
            // 4. Derlenen .hex dosyasını oku
            try {
                const hexContent = await fs.readFile(hexPath, 'utf8');
                res.send({ hex: hexContent });
            } catch (readError) {
                console.error(`Hex Okuma Hatası: ${readError}`);
                res.status(500).send({ error: 'Hex file not found after compilation.', details: readError.message });
            }
        });
    } catch (fsError) {
        console.error(`Dosya İşlemi Hatası: ${fsError}`);
        res.status(500).send({ error: 'File system operation failed', details: fsError.message });
    }
});

// Sunucuyu başlat
app.listen(port, () => {
    console.log(`Arduino CLI Compilation Server listening on port ${port}`);
});