// ==========================================
// GLOBAL DEĞİŞKENLER
// ==========================================
let compiledHexCode = null;
let serialPort = null;
let serialWriter = null;
let blinkInterval = null;

// ==========================================
// 1. NAVİGASYON
// ==========================================
function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if (id !== 'games') stopCurrentGame();
    if (id === 'blockcoding') {
        setTimeout(() => { initBlockly(); if(workspace) Blockly.svgResize(workspace); }, 200);
    }
}

// ==========================================
// 2. GITHUB REPO
// ==========================================
async function fetchGithubRepos() {
    const username = 'SalihAyvaci21';
    const container = document.getElementById('repos-container');
    if (!container) return;
    try {
        const response = await fetch(`https://api.github.com/users/${username}/repos?sort=pushed&direction=desc`);
        const repos = await response.json();
        container.innerHTML = '';
        repos.forEach(repo => {
            if (repo.name === "SalihAyvaci21") return;
            const lang = repo.language || 'Diğer';
            const desc = repo.description || 'Proje detayı yükleniyor...';
            container.innerHTML += `<div class="card"><div class="card-header"><h3><i class="fas fa-code-branch"></i> ${repo.name}</h3><a href="${repo.html_url}" target="_blank" class="repo-link"><i class="fas fa-external-link-alt"></i></a></div><p>${desc}</p><div class="tech-stack"><span class="tech-tag">${lang}</span><span class="tech-tag"><i class="far fa-star"></i> ${repo.stargazers_count}</span></div></div>`;
        });
    } catch (e) { console.error(e); }
}
window.onload = fetchGithubRepos;

// ==========================================
// 3. IOT: DERLEME (Backend Library Destekli)
// ==========================================
async function compileCode() {
    const editorVal = document.getElementById('cppEditor').value;
    const boardType = document.getElementById('boardSelect').value;
    const statusLbl = document.getElementById('statusLabelNew');
    const btnUpload = document.getElementById('btnUploadNew');

    // Sunucuda board parametresi desteklenmiyorsa genelde 'arduino:avr:uno' varsayılır.
    // Ancak avrgirl için 'mega' seçildiyse, hex kodu mega için derlenmeli.
    // Backend'in bu 'board' parametresini alıp fqbn'e çevirmesi gerekir (örn: 'mega' -> 'arduino:avr:mega')
    
    statusLbl.innerText = `Durum: ${boardType.toUpperCase()} için derleniyor...`;
    statusLbl.style.color = "#40c4ff";

    try {
        const response = await fetch('https://arduino-backend-et1z.onrender.com/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                code: editorVal,
                board: boardType // Backend'in bunu işlemesi lazım!
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.stderr || "Derleme Hatası");
        }
        
        const data = await response.json();

        if (data.hex) {
            compiledHexCode = data.hex;
            statusLbl.innerText = "Durum: BAŞARILI! Yüklemeye hazır.";
            statusLbl.style.color = "#00e676";
            btnUpload.disabled = false;
            btnUpload.style.background = "#ff9800";
            btnUpload.style.cursor = "pointer";
            btnUpload.classList.remove('off');
        } else {
            throw new Error("Hex kodu oluşmadı.");
        }
    } catch (err) {
        console.error(err);
        statusLbl.innerText = "Hata: " + err.message;
        statusLbl.style.color = "#ff5252";
    }
}

// ==========================================
// 4. IOT: YÜKLEME (AVRgirl - Çoklu Kart)
// ==========================================
async function runUploader(hexDataToUse = null) {
    const hexToFlash = hexDataToUse || compiledHexCode;
    // HTML'den seçilen kartı al: 'uno', 'mega', 'leonardo' vb.
    const boardType = document.getElementById('boardSelect').value; 

    if (!hexToFlash) {
        alert("Önce kodu derlemelisiniz!");
        return;
    }
    
    // Eğer açık bir seri port bağlantısı varsa (bloklar için), yükleme yapabilmek için kapat.
    if (serialPort) {
        console.log("Yükleme için mevcut bağlantı kesiliyor...");
        await disconnectSerial(true); 
    }

    const statusLbl = document.getElementById('statusLabelNew');
    statusLbl.innerText = `${boardType.toUpperCase()} aranıyor...`;

    try {
        const blob = new Blob([hexToFlash], { type: 'application/octet-stream' });
        const reader = new FileReader();

        reader.onload = function(event) {
            const fileBuffer = event.target.result;
            
            // AVRgirl'e dinamik board bilgisini veriyoruz
            const avrgirl = new AvrgirlArduino({ 
                board: boardType, 
                debug: true 
            });

            avrgirl.flash(fileBuffer, (error) => {
                if (error) {
                    console.error(error);
                    alert("Yükleme Hatası: " + error.message);
                    statusLbl.innerText = "Durum: Yükleme Başarısız.";
                    statusLbl.style.color = "red";
                } else {
                    alert(`BAŞARILI! Kod ${boardType.toUpperCase()} kartına yüklendi.`);
                    statusLbl.innerText = "Durum: Yüklendi.";
                    statusLbl.style.color = "#00e676";
                }
            });
        };
        reader.readAsArrayBuffer(blob);
    } catch (err) {
        alert("Hata: " + err);
    }
}

// ==========================================
// 5. TEST FIRMWARE
// ==========================================
async function runQuickTest() {
    const btn = document.getElementById('btnQuickTest');
    if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        // Basit bir blink kodu (Uno için varsayalım)
        const response = await fetch('firmware.hex');
        if (!response.ok) throw new Error("firmware.hex bulunamadı");
        const hexText = await response.text();
        
        if(btn) btn.innerHTML = '<i class="fas fa-microchip"></i> Yükleniyor...';
        await runUploader(hexText);
        if(btn) btn.innerHTML = '<i class="fas fa-microchip"></i> Test Firmware Yükle';

    } catch (err) {
        alert("Hata: " + err.message);
        if(btn) btn.innerHTML = '<i class="fas fa-microchip"></i> Test Firmware Yükle';
    }
}

// ==========================================
// 6. SERİ PORT (Web Serial API)
// ==========================================
async function connectSerial() {
    if (!navigator.serial) return alert("Tarayıcı desteklemiyor.");
    if (serialPort && serialPort.readable) return alert("Zaten bağlı!");

    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });

        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(serialPort.writable);
        serialWriter = textEncoder.writable.getWriter();

        const badge = document.getElementById('statusBadge');
        if(badge) {
            badge.innerHTML = '<i class="fas fa-circle" style="color:#00e676; font-size:0.6rem;"></i> Bağlandı';
            badge.style.color = "#00e676";
        }
        document.getElementById('serialConsole').innerHTML += "<br>> Bağlantı Başarılı!";
        document.getElementById('btnConnect').style.display = 'none';
        document.getElementById('btnDisconnect').style.display = 'inline-flex';
    } catch (err) { alert("Bağlantı Hatası: " + err); }
}

async function disconnectSerial(silent = false) {
    if(blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; }
    try {
        if (serialWriter) { await serialWriter.releaseLock(); serialWriter = null; }
        if (serialPort) { await serialPort.close(); serialPort = null; }
    } catch(e) { console.log(e); }

    if(!silent) {
        const badge = document.getElementById('statusBadge');
        if(badge) {
            badge.innerHTML = '<i class="fas fa-circle" style="font-size:0.6rem;"></i> Bağlantı Yok';
            badge.style.color = "#aaa";
        }
        document.getElementById('serialConsole').innerHTML += "<br>> Bağlantı Kesildi.";
        document.getElementById('btnConnect').style.display = 'inline-flex';
        document.getElementById('btnDisconnect').style.display = 'none';
    }
}

async function runBlock(command) {
    if (!serialWriter) return alert("Önce Bağlan!");
    try {
        if(blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; }
        if (command === 'ON') await serialWriter.write("1");
        else if (command === 'OFF') await serialWriter.write("0");
        else if (command === 'BLINK') {
            let toggle = false;
            blinkInterval = setInterval(async () => {
                if(!serialWriter) { clearInterval(blinkInterval); return; }
                toggle = !toggle;
                try { await serialWriter.write(toggle ? "1" : "0"); } catch(e){}
            }, 500); 
        }
    } catch (err) { alert("Hata: " + err); }
}

// ==========================================
// 7. OYUNLAR & BLOCKLY (Önceki kodların aynısı)
// ==========================================
// Bu kısımlar değişmediği için yer kaplamaması adına kısalttım. 
// Önceki cevabımdaki initBlockly ve Oyun Fonksiyonlarını buraya aynen ekleyebilirsin.

let workspace = null;
function initBlockly() {
    if (workspace) return; 
    // ... (Blockly tanımları aynen kalacak) ...
    // BURAYA ÖNCEKİ CEVAPTAKİ initBlockly KODUNU YAPIŞTIR
    // Sadece "servo" eklediğimiz gelişmiş versiyonu kullan.
    
    // Geçici olarak hatasız çalışması için kısa bir init koyuyorum, 
    // sen önceki uzun versiyonu buraya koymalısın:
    Blockly.defineBlocksWithJsonArray([{ "type": "arduino_base", "message0": "Arduino Başlat %1 %2", "args0": [ {"type": "input_dummy"}, {"type": "input_statement", "name": "LOOP"} ], "colour": 120 }]);
    const generator = new Blockly.Generator('ARDUINO');
    generator.forBlock['arduino_base'] = function(block) { return `void setup(){}\nvoid loop(){}\n`; };
    workspace = Blockly.inject('blocklyDiv', { toolbox: `<xml><block type="arduino_base"></block></xml>`, theme: Blockly.Themes.Dark });
}
function transferAndCompile() {
    const code = document.getElementById('generatedCode').value;
    const cppEditor = document.getElementById('cppEditor');
    if(cppEditor) cppEditor.value = code;
    const iotBtn = document.querySelector('.nav-btn[onclick*="iot"]');
    if(iotBtn) showSection('iot', iotBtn);
    setTimeout(() => { compileCode(); }, 600);
}

// OYUN KODLARI (SNAKE, TETRIS VB.) BURAYA GELECEK
// ...
