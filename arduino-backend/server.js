const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(bodyParser.json());

const SKETCH_DIR = path.join(__dirname, 'sketch_temp');
const SKETCH_FILE = path.join(SKETCH_DIR, 'sketch_temp.ino');

if (!fs.existsSync(SKETCH_DIR)){
    fs.mkdirSync(SKETCH_DIR);
}

app.post('/compile', (req, res) => {
    const code = req.body.code;
    const board = "arduino:avr:uno"; 

    console.log("Kod alındı...");
    fs.writeFileSync(SKETCH_FILE, code);

    // Arduino-CLI komutu
    const command = `arduino-cli compile --fqbn ${board} "${SKETCH_DIR}" --output-dir "${SKETCH_DIR}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Hata: ${stderr}`);
            return res.status(500).json({ error: stderr || error.message });
        }

        const hexPath = path.join(SKETCH_DIR, 'sketch_temp.ino.hex');
        if (fs.existsSync(hexPath)) {
            const hexContent = fs.readFileSync(hexPath, 'utf8');
            res.json({ hex: hexContent });
        } else {
            res.status(500).json({ error: "Hex oluşturulamadı." });
        }
    });
});

// Render.com'un verdiği portu kullan
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});