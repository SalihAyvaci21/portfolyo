// ==========================================
// GLOBAL DEĞİŞKENLER
// ==========================================
let compiledHexCode = null; // Derlenen kod
let serialPort = null;      // Açık port
let serialWriter = null;    // Veri gönderme aracı
let blinkInterval = null;   // Blink zamanlayıcısı

// ==========================================
// 1. NAVİGASYON VE SAYFA GEÇİŞLERİ (Düzeltildi)
// ==========================================
function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    // Eğer bir link değilse (örneğin CV linki), butona active class'ı eklenir.
    if (btn && btn.classList) {
        btn.classList.add('active');
    }
    
    // Oyun bölümünden çıkınca oyunu durdur
    if (id !== 'games') stopCurrentGame(); 
}

// ==========================================
// 2. GITHUB REPO ÇEKME
// ==========================================
async function fetchGithubRepos() {
    const username = 'SalihAyvaci21';
    const container = document.getElementById('repos-container');
    const gizlenecekler = ["SalihAyvaci21", "portfolyo"];
    if (!container) return;

    try {
        const response = await fetch(`https://api.github.com/users/${username}/repos?sort=pushed&direction=desc`);
        const repos = await response.json();
        container.innerHTML = '';
        repos.forEach(repo => {
            if (gizlenecekler.includes(repo.name)) return;
            const lang = repo.language || 'Diğer';
            const desc = repo.description || 'Proje detayı yükleniyor...';
            container.innerHTML += `<div class="card"><div class="card-header"><h3><i class="fas fa-code-branch"></i> ${repo.name}</h3><a href="${repo.html_url}" target="_blank" class="repo-link"><i class="fas fa-external-link-alt"></i></a></div><p>${desc}</p><div class="tech-stack"><span class="tech-tag">${lang}</span><span class="tech-tag"><i class="far fa-star"></i> ${repo.stargazers_count}</span></div></div>`;
        });
    } catch (e) { console.error(e); }
}
window.onload = fetchGithubRepos;

// ==========================================
// 3. IOT: DERLEME (Backend)
// ==========================================
async function compileCode() {
    const editorVal = document.getElementById('cppEditor').value;
    const statusLbl = document.getElementById('statusLabelNew');
    const btnUpload = document.getElementById('btnUploadNew');

    // !!! BU ADRESİ SİZİN GERÇEK ARDUINO CLI BACKEND URL'NİZ İLE DEĞİŞTİRİN !!!
    const ARDUINO_BACKEND_URL = 'https://portfolyo-1w2x.onrender.com'; // Örnek URL

    statusLbl.innerText = "Durum: Sunucuda derleniyor... (Bekleyin)";
    statusLbl.style.color = "#40c4ff";

    try {
        const response = await fetch(`${ARDUINO_BACKEND_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: editorVal })
        });

        if (!response.ok) {
            let errorDetail = "Bilinmeyen sunucu hatası.";
            try {
                 const errorBody = await response.json();
                 errorDetail = errorBody.details || errorBody.error || errorDetail;
            } catch (e) {
                 errorDetail = await response.text();
            }
            throw new Error(`Sunucu Hatası (${response.status}): ${errorDetail.substring(0, 50)}...`);
        }
        
        const data = await response.json();

        if (data.hex) {
            compiledHexCode = data.hex;
            statusLbl.innerText = "Durum: BAŞARILI! Kodu yükleyebilirsiniz.";
            statusLbl.style.color = "#00e676";
            btnUpload.disabled = false;
            btnUpload.style.background = "#ff9800";
            btnUpload.style.cursor = "pointer";
            btnUpload.classList.remove('off');
        } else {
            throw new Error("Hex kodu boş döndü. Derleme başarısız.");
        }
    } catch (err) {
        console.error("Derleme hatası:", err);
        statusLbl.innerText = "Hata: " + err.message;
        statusLbl.style.color = "#ff5252";
    }
}

// ==========================================
// 4. IOT: YÜKLEME (AVRgirl)
// ==========================================
async function runUploader(hexDataToUse = null) {
    const hexToFlash = hexDataToUse || compiledHexCode;

    if (!hexToFlash) {
        alert("Önce kodu derlemelisiniz veya Test Firmware Yüklemeyi denemelisiniz!");
        return;
    }
    
    if (serialPort) {
        console.log("Mevcut bağlantı yükleme için kesiliyor...");
        await disconnectSerial(true);
    }

    const statusLbl = document.getElementById('statusLabelNew') || document.getElementById('statusBadge');
    if(statusLbl) statusLbl.innerText = "Port Seçiliyor...";

    try {
        const blob = new Blob([hexToFlash], { type: 'application/octet-stream' });
        const reader = new FileReader();

        reader.onload = function(event) {
            const fileBuffer = event.target.result;
            const avrgirl = new AvrgirlArduino({ board: 'uno', debug: true });

            avrgirl.flash(fileBuffer, (error) => {
                if (error) {
                    alert("Yükleme Hatası: " + error.message);
                } else {
                    alert("BAŞARILI! Kod Yüklendi. Şimdi 'Bağlan' diyip kontrol edebilirsiniz.");
                    const badge = document.getElementById('statusBadge');
                    if(badge) {
                        badge.innerHTML = '<i class="fas fa-check"></i> Yüklendi - Bağlanmayı Bekliyor';
                        badge.style.color = "orange";
                    }
                    
                    const testBtn = document.getElementById('btnQuickTest');
                    if(testBtn) {
                        testBtn.disabled = false;
                        testBtn.innerHTML = '<i class="fas fa-microchip"></i> Test Firmware Yükle';
                    }
                }
            });
        };
        reader.readAsArrayBuffer(blob);
    } catch (err) {
        alert("İşlem İptal Edildi: " + err);
        const testBtn = document.getElementById('btnQuickTest');
        if(testBtn) {
            testBtn.disabled = false;
            btnUpload.disabled = true; // Yükleme butonunu tekrar kilitle
            btnUpload.style.background = "#333";
            btnUpload.style.cursor = "not-allowed";
            btnUpload.classList.add('off');
            testBtn.innerHTML = '<i class="fas fa-microchip"></i> Test Firmware Yükle';
        }
    }
}

// ==========================================
// 5. IOT: TEST FIRMWARE YÜKLEME
// ==========================================
async function runQuickTest() {
    const btn = document.getElementById('btnQuickTest');
    const statusLbl = document.getElementById('statusBadge');

    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İndiriliyor...';
    }
    if(statusLbl) statusLbl.innerHTML = '<span style="color:orange">Dosya okunuyor...</span>';

    try {
        // Not: Bu dosyanın kök dizinde bulunduğunu varsayar.
        const response = await fetch('firmware.hex'); 
        if (!response.ok) throw new Error("firmware.hex dosyası bulunamadı!");
        
        const hexText = await response.text();

        if(btn) btn.innerHTML = '<i class="fas fa-microchip"></i> Yükleniyor...';
        
        await runUploader(hexText);

    } catch (err) {
        console.error(err);
        alert("Hata oluştu: " + err.message);
        if(statusLbl) statusLbl.innerHTML = '<span style="color:red">Hata!</span>';
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-microchip"></i> Test Firmware Yükle';
        }
    }
}

// ==========================================
// 6. IOT: SERİ PORT BAĞLANTISI VE KONTROL
// ==========================================

async function connectSerial() {
    if (!navigator.serial) {
        alert("Tarayıcınız Seri Port desteklemiyor. Lütfen Chrome, Edge veya Opera kullanın.");
        return;
    }

    if (serialPort && serialPort.readable) {
        alert("Zaten bağlı!");
        return;
    }

    try {
        serialPort = await navigator.serial.requestPort();
        // AVRgirl için genellikle 115200 Baudrate yeterlidir.
        await serialPort.open({ baudRate: 115200 }); 

        const textEncoder = new TextEncoderStream();
        // Seri porttan veri alma (Okuyucu oluşturulmalı)
        // const reader = serialPort.readable.getReader();
        
        // Seri porta veri gönderme
        textEncoder.readable.pipeTo(serialPort.writable);
        serialWriter = textEncoder.writable.getWriter();

        // Arayüz Güncelleme
        const badge = document.getElementById('statusBadge');
        if(badge) {
            badge.innerHTML = '<i class="fas fa-circle" style="color:#00e676; font-size:0.6rem;"></i> Bağlandı';
            badge.style.color = "#00e676";
        }
        const consoleEl = document.getElementById('serialConsole');
        if (consoleEl) {
             consoleEl.innerHTML += "<br>> <span style='color:#0f0'>Bağlantı Başarılı!</span>";
        }

        // Butonların görünürlüğünü ayarla
        document.getElementById('btnConnect').style.display = 'none';
        document.getElementById('btnDisconnect').style.display = 'inline-flex';

    } catch (err) {
        console.error(err);
        alert("Bağlantı Hatası: " + err);
    }
}

async function disconnectSerial(silent = false) {
    if(blinkInterval) {
        clearInterval(blinkInterval);
        blinkInterval = null;
        document.getElementById('serialConsole').innerHTML += "<br>> <span style='color:orange'>BLINK Durduruldu.</span>";
    }

    try {
        if (serialWriter) {
            await serialWriter.releaseLock();
            serialWriter = null;
        }
        if (serialPort) {
            await serialPort.close();
            serialPort = null;
        }
    } catch(e) {
        console.log("Port kapatma hatası (önemsiz):", e);
    }

    if(!silent) {
        const badge = document.getElementById('statusBadge');
        if(badge) {
            badge.innerHTML = '<i class="fas fa-circle" style="font-size:0.6rem;"></i> Bağlantı Yok';
            badge.style.color = "#aaa";
        }
        
        document.getElementById('serialConsole').innerHTML += "<br>> <span style='color:orange'>Bağlantı Kesildi.</span>";
    
        // Butonların görünürlüğünü ayarla
        document.getElementById('btnConnect').style.display = 'inline-flex';
        document.getElementById('btnDisconnect').style.display = 'none';
    }
}

async function runBlock(command) {
    if (!serialWriter) {
        alert("Önce 'Bağlan' butonuna basarak bağlantıyı kurmalısınız!");
        return;
    }

    try {
        // BLINK döngüsünü durdur
        if(blinkInterval) {
            clearInterval(blinkInterval);
            blinkInterval = null;
            document.getElementById('serialConsole').innerHTML += "<br>> <span style='color:orange'>BLINK Durduruldu.</span>";
        }

        let writeCommand = "";
        let consoleMessage = "";

        if (command === 'ON') {
            writeCommand = "1";
            consoleMessage = "LED YAKILDI (1)";
        }
        else if (command === 'OFF') {
            writeCommand = "0";
            consoleMessage = "LED SÖNDÜRÜLDÜ (0)";
        }
        else if (command === 'BLINK') {
            consoleMessage = "BLINK BAŞLATILDI...";
            document.getElementById('serialConsole').innerHTML += `<br>> <span>${consoleMessage}</span>`;
            let toggle = false;
            blinkInterval = setInterval(async () => {
                if(!serialWriter) { clearInterval(blinkInterval); return; }
                toggle = !toggle;
                try {
                    // Blink komutu için sürekli veri gönderimi
                    await serialWriter.write(toggle ? "1" : "0");
                } catch(e) { 
                    clearInterval(blinkInterval); 
                    blinkInterval = null;
                }
            }, 500); 
            return; // Blink döngüsü başladığı için buradan çık
        }
        
        await serialWriter.write(writeCommand);
        document.getElementById('serialConsole').innerHTML += `<br>> <span>${consoleMessage}</span>`;
    } catch (err) {
        alert("Gönderme Hatası: " + err);
    }
}

// ==========================================
// 7. OYUNLAR (Düzeltildi)
// ==========================================
// Canvas ve Context'i tanımla
let canvas = document.getElementById('gameCanvas');
let ctx = canvas ? canvas.getContext('2d') : null;
let gameInterval, currentGame, score = 0;

function stopCurrentGame() {
    // Canvas ve Context'i tekrar kontrol et
    if(!ctx && canvas) ctx = canvas.getContext('2d');
    if(!ctx) return;
    clearInterval(gameInterval);
    // Canvas'ı temizle
    ctx.clearRect(0, 0, 400, 400); 
    currentGame = null;
}

function startGame(t, b) {
    if(!ctx) { 
        canvas = document.getElementById('gameCanvas');
        ctx = canvas ? canvas.getContext('2d') : null;
        if (!ctx) return; 
    }
    stopCurrentGame();
    // Oyun kartının aktif görünmesini sağlar
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active-game'));
    if(b) b.classList.add('active-game'); 
    
    score = 0;
    const sb = document.getElementById('scoreBoard');
    if(sb) sb.innerText = "SKOR: 0";
    
    if (t === 'snake') initSnake();
    if (t === 'tetris') initTetris();
    if (t === 'maze') initMaze();
}

function initSnake() {
    currentGame = 'snake';
    let snake = [{ x: 10, y: 10 }], apple = { x: 15, y: 15 }, xv = 0, yv = 0;
    document.onkeydown = e => {
        if (currentGame !== 'snake') return;
        if (e.keyCode == 37 && xv != 1) { xv = -1; yv = 0 }
        if (e.keyCode == 38 && yv != 1) { xv = 0; yv = -1 }
        if (e.keyCode == 39 && xv != -1) { xv = 1; yv = 0 }
        if (e.keyCode == 40 && yv != -1) { xv = 0; yv = 1 }
        if ([37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
    };
    gameInterval = setInterval(() => {
        let h = { x: snake[0].x + xv, y: snake[0].y + yv };
        if (h.x < 0) h.x = 19; if (h.x > 19) h.x = 0; if (h.y < 0) h.y = 19; if (h.y > 19) h.y = 0;
        for (let i = 0; i < snake.length; i++) if (snake[i].x == h.x && snake[i].y == h.y) { score = 0; snake = [{ x: 10, y: 10 }]; xv = 0; yv = 0; }
        snake.unshift(h);
        if (h.x == apple.x && h.y == apple.y) {
            score += 10;
            document.getElementById('scoreBoard').innerText = "SKOR: " + score;
            apple = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
        } else snake.pop();
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = '#ff0055'; ctx.fillRect(apple.x * 20, apple.y * 20, 18, 18);
        ctx.fillStyle = '#00ff88'; for (let p of snake) ctx.fillRect(p.x * 20, p.y * 20, 18, 18);
    }, 100);
}

function initTetris() {
    currentGame = 'tetris';
    let board = Array(20).fill().map(() => Array(10).fill(0)), piece = { m: [[[1]]], x: 3, y: 0, c: '#fff' };
    const SHAPES = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[1, 1, 1], [0, 1, 0]], [[1, 1, 1], [1, 0, 0]], [[1, 1, 0], [0, 1, 1]]];
    function newPiece() { piece = { m: SHAPES[Math.floor(Math.random() * 5)], x: 3, y: 0, c: ['#0f8', '#f05', '#70f'][Math.floor(Math.random() * 3)] }; if (collide()) board.forEach(r => r.fill(0)); }
    function collide() { return piece.m.some((r, y) => r.some((v, x) => v && (board[y + piece.y] && board[y + piece.y][x + piece.x]) !== 0)); }
    function draw() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400); ctx.strokeStyle = '#333'; ctx.strokeRect(100, 0, 200, 400);
        board.forEach((r, y) => r.forEach((v, x) => { if (v) { ctx.fillStyle = '#333'; ctx.fillRect(x * 20 + 100, y * 20, 19, 19); } }));
        piece.m.forEach((r, y) => r.forEach((v, x) => { if (v) { ctx.fillStyle = piece.c; ctx.fillRect((x + piece.x) * 20 + 100, (y + piece.y) * 20, 19, 19); } }));
    }
    function update() {
        piece.y++;
        if (collide()) {
            piece.y--; piece.m.forEach((r, y) => r.forEach((v, x) => { if (v) board[y + piece.y][x + piece.x] = 1; }));
            for (let y = 19; y > 0; y--) if (board[y].every(x => x)) { board.splice(y, 1); board.unshift(Array(10).fill(0)); score += 100; y++; } newPiece();
        } draw();
    }
    newPiece(); gameInterval = setInterval(update, 500);
    document.onkeydown = e => {
        if (currentGame !== 'tetris') return;
        if (e.keyCode == 37) { piece.x--; if (collide()) piece.x++ }
        if (e.keyCode == 39) { piece.x++; if (collide()) piece.x-- }
        if (e.keyCode == 40) update();
        if (e.keyCode == 38) { let old = piece.m; piece.m = piece.m[0].map((_, i) => piece.m.map(r => r[i]).reverse()); if (collide()) piece.m = old; } draw();
        if ([37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
    };
}

function initMaze() {
    currentGame = 'maze';
    let map = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 0, 0, 0, 1, 0, 0, 0, 0, 1], [1, 0, 1, 0, 1, 0, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 0, 0, 0, 1], [1, 0, 1, 1, 1, 1, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 0, 0, 0, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]];
    let p = { x: 1, y: 1 }, g = { x: 8, y: 5 };
    function draw() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        for (let y = 0; y < 7; y++) for (let x = 0; x < 10; x++) { if (map[y][x] == 1) { ctx.fillStyle = '#03c'; ctx.fillRect(x * 40, y * 40, 40, 40); } else if (map[y][x] == 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x * 40 + 20, y * 40 + 20, 4, 0, 6.28); ctx.fill(); } }
        ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(p.x * 40 + 20, p.y * 40 + 20, 15, 0.6, 5.6); ctx.fill(); ctx.fillStyle = '#f00'; ctx.fillRect(g.x * 40 + 5, g.y * 40 + 5, 30, 30);
    }
    gameInterval = setInterval(() => {
        if (Math.random() > 0.5) {
            let m = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter(d => map[g.y + d.y] && map[g.y + d.y][g.x + d.x] != 1);
            if (m.length) { let nm = m[Math.floor(Math.random() * m.length)]; g.x += nm.x; g.y += nm.y; }
        }
        if (p.x == g.x && p.y == g.y) { score = 0; p = { x: 1, y: 1 }; g = { x: 8, y: 5 }; alert("Yakaladın!"); } draw();
    }, 500);
    document.onkeydown = e => {
        if (currentGame !== 'maze') return;
        let nx = p.x, ny = p.y;
        if (e.keyCode == 37) nx--; if (e.keyCode == 39) nx++; if (e.keyCode == 38) ny--; if (e.keyCode == 40) ny++;
        if (map[ny] && map[ny][nx] != 1) { p.x = nx; p.y = ny; if (map[ny][nx] == 0) { score += 10; map[ny][nx] = 2; document.getElementById('scoreBoard').innerText = "SKOR: " + score; } } draw();
        if ([37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
    };
    draw();
}
