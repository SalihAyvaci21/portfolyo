// ==========================================
// GLOBAL DEĞİŞKENLER
// ==========================================
let compiledHexCode = null; // Derlenen kod
let serialPort = null;      // Açık port
let serialWriter = null;    // Veri gönderme aracı
let blinkInterval = null;   // Blink zamanlayıcısı

// ==========================================
// 1. NAVİGASYON VE SAYFA GEÇİŞLERİ
// ==========================================
function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if (id !== 'games') stopCurrentGame();

    // Blok kodlama sekmesine geçilirse Blockly'i yükle ve yeniden boyutlandır
    if (id === 'blockcoding') {
        setTimeout(() => {
            initBlockly();
            if(workspace) Blockly.svgResize(workspace);
        }, 200);
    }
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

    statusLbl.innerText = "Durum: Sunucuda derleniyor... (Bekleyin)";
    statusLbl.style.color = "#40c4ff";

    try {
        const response = await fetch('https://arduino-backend-et1z.onrender.com/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: editorVal })
        });

        if (!response.ok) throw new Error("Sunucu Hatası");
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
            throw new Error("Hex kodu boş döndü.");
        }
    } catch (err) {
        console.error(err);
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
        alert("Tarayıcınız Seri Port desteklemiyor.");
        return;
    }

    if (serialPort && serialPort.readable) {
        alert("Zaten bağlı!");
        return;
    }

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
        document.getElementById('serialConsole').innerHTML += "<br>> <span style='color:#0f0'>Bağlantı Başarılı!</span>";

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
        if(blinkInterval) {
            clearInterval(blinkInterval);
            blinkInterval = null;
        }

        if (command === 'ON') {
            await serialWriter.write("1");
            document.getElementById('serialConsole').innerHTML += `<br>> LED YAKILDI (1)`;
        }
        else if (command === 'OFF') {
            await serialWriter.write("0");
            document.getElementById('serialConsole').innerHTML += `<br>> LED SÖNDÜRÜLDÜ (0)`;
        }
        else if (command === 'BLINK') {
            document.getElementById('serialConsole').innerHTML += `<br>> BLINK BAŞLATILDI...`;
            let toggle = false;
            blinkInterval = setInterval(async () => {
                if(!serialWriter) { clearInterval(blinkInterval); return; }
                toggle = !toggle;
                try {
                    await serialWriter.write(toggle ? "1" : "0");
                } catch(e) { clearInterval(blinkInterval); }
            }, 500); 
        }
    } catch (err) {
        alert("Gönderme Hatası: " + err);
    }
}

// ==========================================
// 7. OYUNLAR (GELİŞTİRİLMİŞ KONTROL & UI)
// ==========================================
let canvas = document.getElementById('gameCanvas');
let ctx = canvas ? canvas.getContext('2d') : null;
let gameInterval, currentGame, score = 0;

// Sayfa kaymasını engellemek için Global Listener
window.addEventListener("keydown", function(e) {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
        // Sadece oyun oynanıyorsa kaydırmayı engelle
        if (currentGame) {
            e.preventDefault();
        }
    }
}, false);

function stopCurrentGame() {
    if(!ctx) return;
    clearInterval(gameInterval);
    ctx.clearRect(0, 0, 400, 400);
    // Başlangıç ekranı yazısı
    ctx.fillStyle = "#333";
    ctx.font = "20px Courier New";
    ctx.fillText("OYUN SEÇİNİZ", 130, 200);
    currentGame = null;
}
// Sayfa ilk açıldığında boş ekranı çiz
stopCurrentGame();

function startGame(t, b) {
    if(!ctx) return;
    stopCurrentGame();
    // Buton aktifliği
    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active-game'));
    if(b) b.classList.add('active-game');
    
    score = 0;
    updateScore(0);
    
    if (t === 'snake') initSnake();
    if (t === 'tetris') initTetris();
    if (t === 'maze') initMaze();
    if (t === 'pong') initPong();
    if (t === 'breakout') initBreakout();
}

function updateScore(val) {
    const sb = document.getElementById('scoreBoard');
    if(sb) sb.innerText = "SKOR: " + String(val).padStart(4, '0');
}

// SANAL TUŞLARI KLAVYE GİBİ DAVRANDIRMA
function handleControl(keyCode) {
    // Yapay bir keydown event'i tetikle
    const event = new KeyboardEvent('keydown', {'keyCode': keyCode});
    document.onkeydown(event);
}
function handleControlRelease() {
    // Gerekirse keyup eklenebilir
}

// --- SNAKE ---
function initSnake() {
    currentGame = 'snake';
    let snake = [{ x: 10, y: 10 }], apple = { x: 15, y: 15 }, xv = 0, yv = 0;
    
    document.onkeydown = e => {
        if (currentGame !== 'snake') return;
        if (e.keyCode == 37 && xv != 1) { xv = -1; yv = 0 }
        if (e.keyCode == 38 && yv != 1) { xv = 0; yv = -1 }
        if (e.keyCode == 39 && xv != -1) { xv = 1; yv = 0 }
        if (e.keyCode == 40 && yv != -1) { xv = 0; yv = 1 }
    };

    gameInterval = setInterval(() => {
        let h = { x: snake[0].x + xv, y: snake[0].y + yv };
        if (h.x < 0) h.x = 19; if (h.x > 19) h.x = 0; if (h.y < 0) h.y = 19; if (h.y > 19) h.y = 0;
        
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x == h.x && snake[i].y == h.y) { 
                score = 0; updateScore(0); snake = [{ x: 10, y: 10 }]; xv = 0; yv = 0; 
            }
        }
        
        snake.unshift(h);
        if (h.x == apple.x && h.y == apple.y) {
            score += 10;
            updateScore(score);
            apple = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
        } else snake.pop();
        
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = '#ff0055'; ctx.fillRect(apple.x * 20, apple.y * 20, 18, 18); // Elma
        ctx.fillStyle = '#00ff88'; for (let p of snake) ctx.fillRect(p.x * 20, p.y * 20, 18, 18); // Yılan
        // Grid çizgileri (estetik)
        ctx.strokeStyle = '#111'; ctx.beginPath();
        for(let i=0; i<400; i+=20) { ctx.moveTo(i,0); ctx.lineTo(i,400); ctx.moveTo(0,i); ctx.lineTo(400,i); }
        ctx.stroke();
    }, 100);
}

// --- TETRIS ---
function initTetris() {
    currentGame = 'tetris';
    let board = Array(20).fill().map(() => Array(10).fill(0));
    let piece = { m: [[[1]]], x: 3, y: 0, c: '#fff' };
    const SHAPES = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[1, 1, 1], [0, 1, 0]], [[1, 1, 1], [1, 0, 0]], [[1, 1, 0], [0, 1, 1]]];
    
    function newPiece() { 
        piece = { m: SHAPES[Math.floor(Math.random() * 5)], x: 3, y: 0, c: ['#0f8', '#f05', '#70f', '#ff0'][Math.floor(Math.random() * 4)] }; 
        if (collide()) board.forEach(r => r.fill(0)); 
    }
    
    function collide() { return piece.m.some((r, y) => r.some((v, x) => v && (board[y + piece.y] && board[y + piece.y][x + piece.x]) !== 0)); }
    
    function draw() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400); 
        ctx.strokeStyle = '#333'; ctx.strokeRect(100, 0, 200, 400); // Oyun alanı sınırları
        
        // Sabit parçalar
        board.forEach((r, y) => r.forEach((v, x) => { 
            if (v) { ctx.fillStyle = '#555'; ctx.fillRect(x * 20 + 100, y * 20, 19, 19); } 
        }));
        // Hareketli parça
        piece.m.forEach((r, y) => r.forEach((v, x) => { 
            if (v) { ctx.fillStyle = piece.c; ctx.fillRect((x + piece.x) * 20 + 100, (y + piece.y) * 20, 19, 19); } 
        }));
    }
    
    function update() {
        piece.y++;
        if (collide()) {
            piece.y--; 
            piece.m.forEach((r, y) => r.forEach((v, x) => { if (v) board[y + piece.y][x + piece.x] = 1; }));
            for (let y = 19; y > 0; y--) if (board[y].every(x => x)) { 
                board.splice(y, 1); board.unshift(Array(10).fill(0)); 
                score += 100; updateScore(score); y++; 
            } 
            newPiece();
        } 
        draw();
    }
    
    newPiece(); 
    gameInterval = setInterval(update, 500);
    
    document.onkeydown = e => {
        if (currentGame !== 'tetris') return;
        if (e.keyCode == 37) { piece.x--; if (collide()) piece.x++ }
        if (e.keyCode == 39) { piece.x++; if (collide()) piece.x-- }
        if (e.keyCode == 40) update();
        if (e.keyCode == 38) { 
            let old = piece.m; 
            piece.m = piece.m[0].map((_, i) => piece.m.map(r => r[i]).reverse()); 
            if (collide()) piece.m = old; 
        } 
        draw();
    };
}

// --- MAZE ---
function initMaze() {
    currentGame = 'maze';
    // Daha basit bir harita
    let map = [
        [1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,1,0,0,0,0,1],
        [1,0,1,0,1,0,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,1,1,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1]
    ];
    let p = { x: 1, y: 1 }, g = { x: 8, y: 5 };
    
    function draw() {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        // Haritayı çiz (40x40 piksel kareler - 10x10 grid sığdırmak için ölçekleme)
        // 400/10 = 40px bloklar
        for (let y = 0; y < 7; y++) for (let x = 0; x < 10; x++) { 
            if (map[y][x] == 1) { 
                ctx.fillStyle = '#222'; ctx.strokeStyle='#00ff88'; ctx.lineWidth=2;
                ctx.fillRect(x * 40, y * 40, 40, 40); 
                ctx.strokeRect(x * 40, y * 40, 40, 40);
            } else if (map[y][x] == 0) { 
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x * 40 + 20, y * 40 + 20, 3, 0, 6.28); ctx.fill(); 
            } 
        }
        // Oyuncu
        ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(p.x * 40 + 20, p.y * 40 + 20, 15, 0, 6.28); ctx.fill(); 
        // Hedef
        ctx.fillStyle = '#f00'; ctx.fillRect(g.x * 40 + 10, g.y * 40 + 10, 20, 20);
    }
    
    gameInterval = setInterval(() => {
        // Hayalet/Hedef rastgele hareket etsin
        if (Math.random() > 0.7) {
            let m = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter(d => map[g.y + d.y] && map[g.y + d.y][g.x + d.x] != 1);
            if (m.length) { let nm = m[Math.floor(Math.random() * m.length)]; g.x += nm.x; g.y += nm.y; }
        }
        if (p.x == g.x && p.y == g.y) { 
            score = 0; updateScore(0); p = { x: 1, y: 1 }; g = { x: 8, y: 5 }; alert("Yakaladın!"); 
        } 
        draw();
    }, 500);
    
    document.onkeydown = e => {
        if (currentGame !== 'maze') return;
        let nx = p.x, ny = p.y;
        if (e.keyCode == 37) nx--; if (e.keyCode == 39) nx++; if (e.keyCode == 38) ny--; if (e.keyCode == 40) ny++;
        
        if (map[ny] && map[ny][nx] != 1) { 
            p.x = nx; p.y = ny; 
            if (map[ny][nx] == 0) { 
                score += 10; updateScore(score); map[ny][nx] = 2; // Yendi
            } 
        } 
        draw();
    };
    draw();
}

// --- PONG (YENİ) ---
function initPong() {
    currentGame = 'pong';
    let playerY = 150, aiY = 150;
    let ball = { x: 200, y: 200, dx: 4, dy: 4, size: 8 };
    const paddleH = 60, paddleW = 10;

    gameInterval = setInterval(() => {
        // Hareket
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Duvar Çarpışması (Üst/Alt)
        if (ball.y < 0 || ball.y > 400) ball.dy *= -1;

        // Raket Çarpışması
        if (ball.x < 20 && ball.y > playerY && ball.y < playerY + paddleH) {
            ball.dx *= -1.1; // Hızlanarak dön
            score += 10; updateScore(score);
        }
        if (ball.x > 380 && ball.y > aiY && ball.y < aiY + paddleH) {
            ball.dx *= -1.1;
        }

        // Gol Olma Durumu
        if (ball.x < 0) { // AI Kazandı
            score = 0; updateScore(0); ball = {x:200, y:200, dx:4, dy:4, size:8};
        }
        if (ball.x > 400) { // Oyuncu Kazandı
            score += 100; updateScore(score); ball = {x:200, y:200, dx:-4, dy:4, size:8};
        }

        // AI Hareketi
        if (aiY + paddleH/2 < ball.y) aiY += 3;
        else aiY -= 3;

        // Çizim
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(200,0); ctx.lineTo(200,400); ctx.stroke();
        
        ctx.fillStyle = '#00ff88'; ctx.fillRect(10, playerY, paddleW, paddleH); // Oyuncu
        ctx.fillStyle = '#ff0055'; ctx.fillRect(380, aiY, paddleW, paddleH); // AI
        ctx.fillStyle = '#fff'; ctx.fillRect(ball.x, ball.y, ball.size, ball.size); // Top

    }, 1000/60);

    // Kontroller
    document.onkeydown = e => {
        if (currentGame !== 'pong') return;
        if (e.keyCode == 38) playerY -= 20; // Yukarı
        if (e.keyCode == 40) playerY += 20; // Aşağı
        if (playerY < 0) playerY = 0;
        if (playerY > 340) playerY = 340;
    };
}

// --- BREAKOUT (YENİ) ---
function initBreakout() {
    currentGame = 'breakout';
    let paddleX = 160;
    let ball = { x: 200, y: 300, dx: 3, dy: -3, size: 8 };
    let bricks = [];
    
    // Tuğlaları Oluştur
    for(let c=0; c<8; c++) {
        for(let r=0; r<5; r++) {
            bricks.push({ x: c*(400/8)+5, y: r*20+30, status: 1 });
        }
    }

    gameInterval = setInterval(() => {
        // Hareket
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Duvarlar
        if(ball.x < 0 || ball.x > 400) ball.dx *= -1;
        if(ball.y < 0) ball.dy *= -1;
        
        // Raket
        if(ball.y > 380 && ball.x > paddleX && ball.x < paddleX + 80) {
            ball.dy *= -1;
            ball.dx = 6 * ((ball.x-(paddleX+40))/40); // Köşeye çarparsa açı değişsin
        }

        // Yandı
        if(ball.y > 400) {
            score = 0; updateScore(0);
            ball = { x: 200, y: 300, dx: 3, dy: -3, size: 8 };
            // Tuğlaları yenile
            bricks.forEach(b => b.status = 1);
        }

        // Tuğla Kırma
        bricks.forEach(b => {
            if(b.status == 1) {
                if(ball.x > b.x && ball.x < b.x+45 && ball.y > b.y && ball.y < b.y+15) {
                    ball.dy *= -1;
                    b.status = 0;
                    score += 10; updateScore(score);
                }
            }
        });

        // Çizim
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = '#00bcd4'; ctx.fillRect(paddleX, 385, 80, 10); // Raket
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 5, 0, Math.PI*2); ctx.fill(); // Top

        bricks.forEach(b => {
            if(b.status == 1) {
                ctx.fillStyle = `hsl(${b.y}, 70%, 50%)`; // Renkli tuğlalar
                ctx.fillRect(b.x, b.y, 45, 15);
            }
        });

    }, 1000/60);

    document.onkeydown = e => {
        if (currentGame !== 'breakout') return;
        if (e.keyCode == 37) paddleX -= 25;
        if (e.keyCode == 39) paddleX += 25;
        if (paddleX < 0) paddleX = 0;
        if (paddleX > 320) paddleX = 320;
    };
}

// ==========================================
// 8. BLOCKLY ENTEGRASYONU (GELİŞMİŞ - SERVO/PWM/LM35)
// ==========================================
let workspace = null;

function initBlockly() {
    if (workspace) return; 

    // 1. Yeni Blok Tanımları (PWM, Servo, LM35 eklendi)
    Blockly.defineBlocksWithJsonArray([
        {
            "type": "arduino_base",
            "message0": "Arduino Başlat %1 Kurulum (Setup) %2 %3 Ana Döngü (Loop) %4 %5",
            "args0": [
                { "type": "input_dummy" },
                { "type": "input_statement", "name": "SETUP" },
                { "type": "input_dummy" },
                { "type": "input_statement", "name": "LOOP" },
                { "type": "input_dummy" }
            ],
            "colour": 120,
            "tooltip": "Kodun ana gövdesi"
        },
        {
            "type": "led_set",
            "message0": "Dijital Yaz (LED) %1 Durum: %2",
            "args0": [
                { "type": "field_dropdown", "name": "PIN", "options": [["Pin 13", "13"], ["Pin 12", "12"], ["Pin 11", "11"], ["Pin 2", "2"]] },
                { "type": "field_dropdown", "name": "STATE", "options": [["YAK (HIGH)", "HIGH"], ["SÖNDÜR (LOW)", "LOW"]] }
            ],
            "previousStatement": null,
            "nextStatement": null,
            "colour": 230
        },
        {
            "type": "pwm_set",
            "message0": "PWM Yaz (AnalogWrite) %1 Değer (0-255): %2",
            "args0": [
                { "type": "field_dropdown", "name": "PIN", "options": [["Pin 3", "3"], ["Pin 5", "5"], ["Pin 6", "6"], ["Pin 9", "9"], ["Pin 10", "10"], ["Pin 11", "11"]] },
                { "type": "input_value", "name": "VAL", "check": "Number" }
            ],
            "previousStatement": null,
            "nextStatement": null,
            "colour": 230,
            "tooltip": "Motor hızı veya LED parlaklığı için"
        },
        {
            "type": "servo_move",
            "message0": "Servo Motor (Pin %1) Açı: %2 derece",
            "args0": [
                { "type": "field_dropdown", "name": "PIN", "options": [["9", "9"], ["10", "10"], ["3", "3"], ["5", "5"]] },
                { "type": "input_value", "name": "DEGREE", "check": "Number" }
            ],
            "previousStatement": null,
            "nextStatement": null,
            "colour": 300,
            "tooltip": "Servo kütüphanesini kullanır"
        },
        {
            "type": "lm35_read",
            "message0": "LM35 Sıcaklık Oku (Pin %1)",
            "args0": [
                { "type": "field_dropdown", "name": "PIN", "options": [["A0", "A0"], ["A1", "A1"], ["A2", "A2"]] }
            ],
            "output": "Number",
            "colour": 180,
            "tooltip": "Santigrat derece döndürür"
        },
        {
            "type": "math_number",
            "message0": "%1",
            "args0": [{ "type": "field_number", "name": "NUM", "value": 0 }],
            "output": "Number",
            "colour": 210
        },
        {
            "type": "delay_ms",
            "message0": "%1 ms bekle",
            "args0": [{ "type": "field_number", "name": "MS", "value": 1000 }],
            "previousStatement": null,
            "nextStatement": null,
            "colour": 160
        }
    ]);

    // 2. Generator ve "Definitions" Yönetimi
    const generator = new Blockly.Generator('ARDUINO');
    
    // Global değişkenleri ve kütüphaneleri saklamak için depo
    generator.definitions_ = {};
    generator.setups_ = {};

    generator.scrub_ = function(block, code) {
        const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
        const nextCode = generator.blockToCode(nextBlock);
        return code + nextCode;
    };

    // --- BLOK ÇEVİRİLERİ ---

    generator.forBlock['arduino_base'] = function(block, generator) {
        var setupCode = generator.statementToCode(block, 'SETUP');
        var loopCode = generator.statementToCode(block, 'LOOP');
        
        // Setup bloğuna eklenen otomatik kodları al (Servo attach vb.)
        var autoSetup = "";
        for (var key in generator.setups_) {
            autoSetup += generator.setups_[key] + "\n";
        }

        // Global tanımları al (Include, Variables)
        var definitions = "";
        for (var key in generator.definitions_) {
            definitions += generator.definitions_[key] + "\n";
        }

        return `${definitions}\nvoid setup() {\n  Serial.begin(115200);\n${autoSetup}${setupCode}}\n\nvoid loop() {\n${loopCode}}\n`;
    };

    generator.forBlock['led_set'] = function(block, generator) {
        var pin = block.getFieldValue('PIN');
        var state = block.getFieldValue('STATE');
        // Setup kısmına pinMode ekleyelim (Eğer daha önce eklenmediyse)
        generator.setups_['pin_' + pin] = `  pinMode(${pin}, OUTPUT);`;
        return `  digitalWrite(${pin}, ${state});\n`;
    };

    generator.forBlock['pwm_set'] = function(block, generator) {
        var pin = block.getFieldValue('PIN');
        var val = generator.valueToCode(block, 'VAL', 0) || '0';
        generator.setups_['pin_' + pin] = `  pinMode(${pin}, OUTPUT);`;
        return `  analogWrite(${pin}, ${val});\n`;
    };

    generator.forBlock['servo_move'] = function(block, generator) {
        var pin = block.getFieldValue('PIN');
        var degree = generator.valueToCode(block, 'DEGREE', 0) || '90';
        
        // 1. Kütüphaneyi ekle
        generator.definitions_['include_servo'] = '#include <Servo.h>';
        // 2. Servo nesnesi oluştur (Global)
        generator.definitions_['var_servo' + pin] = `Servo servo_${pin};`;
        // 3. Setup içinde attach et
        generator.setups_['servo_attach' + pin] = `  servo_${pin}.attach(${pin});`;
        
        return `  servo_${pin}.write(${degree});\n`;
    };

    generator.forBlock['lm35_read'] = function(block, generator) {
        var pin = block.getFieldValue('PIN');
        // LM35 formülü: (AnalogRead * 5.0 / 1024.0) * 100
        return [`(analogRead(${pin}) * 0.48828125)`, 0]; // Order 0 = Atomic
    };

    generator.forBlock['math_number'] = function(block) {
        return [String(block.getFieldValue('NUM')), 0];
    };

    generator.forBlock['delay_ms'] = function(block) {
        return `  delay(${block.getFieldValue('MS')});\n`;
    };

    // 3. Workspace Oluşturma
    workspace = Blockly.inject('blocklyDiv', {
        toolbox: `
        <xml>
            <category name="Temel" colour="120">
                <block type="arduino_base"></block>
                <block type="delay_ms"></block>
            </category>
            <category name="Giriş/Çıkış" colour="230">
                <block type="led_set"></block>
                <block type="pwm_set">
                    <value name="VAL"><block type="math_number"><field name="NUM">128</field></block></value>
                </block>
            </category>
            <category name="Motorlar" colour="300">
                <block type="servo_move">
                    <value name="DEGREE"><block type="math_number"><field name="NUM">90</field></block></value>
                </block>
            </category>
            <category name="Sensörler" colour="180">
                <block type="lm35_read"></block>
            </category>
            <category name="Matematik" colour="210">
                <block type="math_number"></block>
            </category>
        </xml>`,
        trashcan: true,
        move: { scrollbars: true, drag: true, wheel: true },
        zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
        theme: Blockly.Themes.Dark 
    });

    const startBlock = workspace.newBlock('arduino_base');
    startBlock.initSvg();
    startBlock.render();
    startBlock.moveBy(50, 50);

    // Her değişiklikte kodu sıfırla ve yeniden oluştur
    workspace.addChangeListener(() => {
        // Global tanımları temizle ki tekrar tekrar yazmasın
        generator.definitions_ = {};
        generator.setups_ = {};
        
        const code = generator.workspaceToCode(workspace);
        document.getElementById('generatedCode').value = code;
    });
}

function transferAndCompile() {
    const code = document.getElementById('generatedCode').value;
    
    const cppEditor = document.getElementById('cppEditor');
    if(cppEditor) {
        cppEditor.value = code;
    }

    const iotBtn = document.querySelector('.nav-btn[onclick*="iot"]');
    if(iotBtn) showSection('iot', iotBtn);

    setTimeout(() => {
        compileCode();
    }, 600);
}
