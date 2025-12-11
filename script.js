// ==========================================
// WEB SERIAL API (EĞİTİM MODU)
// ==========================================
let port;
let writer;
let blinkInterval;

async function connectSerial() {
    if (!("serial" in navigator)) {
        logConsole("⚠️ Tarayıcınız desteklemiyor.");
        return;
    }
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();
        logConsole("✅ Arduino Bağlandı! Blokları kullanabilirsiniz.");
        document.getElementById('btnConnect').innerText = "Bağlandı ✅";
        document.getElementById('btnConnect').classList.add('on');
    } catch (err) {
        logConsole("❌ Hata: " + err);
    }
}

async function sendCommand(cmd) {
    if (!writer) {
        logConsole("⚠️ Önce cihazı bağlayın!");
        return;
    }
    // Komut sonuna \n ekliyoruz ki Arduino satırın bittiğini anlasın
    await writer.write(cmd + "\n");
    logConsole("📤 Gönderildi: " + cmd);
}

// Blokları Çalıştıran Fonksiyon
function runBlock(action) {
    if (action === 'ON') {
        let pin = document.getElementById('pinSelectOn').value;
        sendCommand(`PIN:${pin}:1`); // Protokol: PIN:13:1
    } 
    else if (action === 'OFF') {
        let pin = document.getElementById('pinSelectOff').value;
        sendCommand(`PIN:${pin}:0`); // Protokol: PIN:13:0
    }
}

// Yanıp Sönme (Blink) Fonksiyonu
function toggleBlink() {
    if (blinkInterval) {
        clearInterval(blinkInterval);
        blinkInterval = null;
        logConsole("⏹️ Blink Durduruldu.");
    } else {
        let pin = document.getElementById('pinSelectBlink').value;
        let state = 1;
        logConsole("▶️ Blink Başlatıldı (Pin " + pin + ")");
        
        blinkInterval = setInterval(() => {
            sendCommand(`PIN:${pin}:${state}`);
            state = (state === 1) ? 0 : 1; // Durumu tersine çevir
        }, 1000); // 1 saniye aralıkla
    }
}

function logConsole(msg) {
    const consoleDiv = document.getElementById('serialConsole');
    consoleDiv.innerHTML = `<div>> ${msg}</div>` + consoleDiv.innerHTML;
}
