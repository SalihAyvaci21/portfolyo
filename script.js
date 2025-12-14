// ==========================================
// GLOBAL DEĞİŞKENLER VE AYARLAR
// ==========================================
let compiledHexCode = null;
let serialPort = null;
let serialWriter = null;
let blinkInterval = null;
let blocklyWorkspace = null; // Blockly çalışma alanı objesi

// ÖN TANIMLI HEX: Seri portu dinleyen temel Arduino kodu.
const UNIVERSAL_HEX = `:100000000C945C000C946E000C946E000C946E0025
:100010000C946E000C946E000C946E000C946E000C
:100020000C946E000C946E000C946E000C946E00FC
:100030000C946E000C946E000C946E000C946E00EC
:100040000C9432020C946E000C9455030C942F030E
:100050000C946E000C946E000C946E000C946E00CC
:100060000C946E000C946E000000000024002700BD
:100070002A0000000000250028002B000404040492
:100080000404040402020202020203030303030306
:1000900001020408102040800102040810200102E3
:1000A00004081020000000080002010000030407BF
:1000B000000000000000000021E0A0E0B1E001C01D
:1000C0001D92A930B207E1F70E942D050C9463050C
:1000D0000C94000080E090E008952F923F924F9256
:1000E0005F926F927F928F929F92AF92BF92CF9216
:1000F000DF92EF92FF920F931F93CF93DF9300003A
:100100008091000187FD0DC080916000909161008C
:10011000009719F001979093610080936000E3CF90
:100120008091C00085FFFCCF8091C6009091C700DC
:10013000892B89F000E010E00E947303841103C0AE
:100140008091C00085FFFCCF8091C600089590915C
:10015000C00095FFFCCF8093600080E090E0089531
:10016000CF93DF93EC0180E090E00E943901803369
:1001700011F0813349F48D910E946201813131F4E3
:1001800080E090E00E94390180E00E946201089587
:1001900080E090E00E94390180E00E9462010895EF
:1001A000DF91CF910895CF92DF92EF92FF920F93D7
:1001B0001F93CF93DF9300000E949D0020E032C0D4
:1001C0000E94A10080E090E00E943901803321F459
:1001D000813359F480E090E00E94390180E090E047
:1001E0000E943901813309F45BC0803309F45EC037
:1001F0008D91813329F480E00E94620120E0E5CF7C
:10020000803329F480E00E94620120E0DFCFF894DD
:10021000FFCF0E949D0021E00E94B30022E030E0FA
:10022000E0E0F0E080E090E00E94230180E892E0CA
:100230000E94670221E0892B09F420E0822F0E94AC
:100240002301E3CFF894FFCF0F900FBE0F901F905D
:1002500018951F920F920FB60F9211242F933F93E5
:100260008F939F93AF93BF93809103019091040183
:10027000A0910501B09106013091020123E0230F7C
:100280002D3758F50196A11DB11D209302018093E1
:10029000030190930401A0930501B09306018091CD
:1002A000070190910801A0910901B0910A010196DA
:1002B000A11DB11D8093070190930801A093090123
:1002C000B0930A01BF91AF919F918F913F912F91BA
:1002D0000F900FBE0F901F9018951F920F920FB69C
:1002E0000F9211242F933F938F939F93AF93BF93E0
:1002F000EF93FF938091800090918100009791F099
:10030000019790938100809380000E94000000005C
:1003100082E090E00E943901FF91EF91BF91AF9176
:100320009F918F913F912F910F900FBE0F901F9034
:10033000189585E00E943C0120E030E040E050E063
:1003400060E070E080E090E00E94670208952F929A
:100350003F924F925F926F927F928F929F92AF92AA
:10036000BF92CF92DF92EF92FF920F931F93CF939A
:10037000DF93CDB7DEB72091000130910101203009
:10038000310579F48091000190910101892B71F026
:1003900028E030E040E050E060E070E080E090E00E
:1003A0000E9467028091000190910101019690934F
:1003B000010180930001892B09F408C020910001E3
:1003C000309101012130310519F028E030E0E0CFE7
:1003D00082E00E943C0120910001309101012F5F40
:1003E0003F4F3093010120930001DF91CF911F919E
:1003F0000F91FF90EF90DF90CF90BF90AF909F903E
:100400008F907F906F905F904F903F902F90089539
:02041000FFCF3C
:0400000300004000B9
:00000001FF`;


// ==========================================
// 1. NAVİGASYON VE BLOCKS YÖNETİMİ
// ==========================================
function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if (id !== 'games') stopCurrentGame();
    
    // Blockly çalışma alanını temizle
    if (id !== 'blocks' && blocklyWorkspace) {
        // Blok sayfasından çıkınca kaynakları serbest bırak
        blocklyWorkspace.dispose();
        blocklyWorkspace = null;
    }
}

// YENİ: Blockly bölümünü gösteren ve başlatan fonksiyon
function showBlocksSection(btn) {
    // 1. Sekme değiştirilir
    showSection('blocks', btn);
    
    // 2. Blockly'nin init fonksiyonu, tarayıcıya çizim yapması için zaman vererek çağrılır.
    // Bu, "display: none" -> "display: block" geçişinden sonra doğru boyutlanmasını sağlar.
    setTimeout(() => {
        if (!blocklyWorkspace) {
            initBlockly();
        } else {
            // Blockly yeniden boyutlandırma
            Blockly.svgResize(blocklyWorkspace);
        }
    }, 100); // 100ms gecikme
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
// 3. IOT: DERLEME (SUNUCUSUZ ANALİZ)
// ==========================================
async function compileCode() {
    
    const editorVal = document.getElementById('cppEditor').value;
    const statusLbl = document.getElementById('statusLabelNew');
    const btnUpload = document.getElementById('btnUploadNew');
    
    const isBasicSerialControl = editorVal.includes('Serial.begin(115200)') && editorVal.includes('Serial.read()'); 

    statusLbl.innerText = "Durum: Kod analizi yapılıyor... (Hızlı Derleyici Emülasyonu)";
    statusLbl.style.color = "#40c4ff";

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!isBasicSerialControl) {
        statusLbl.innerText = "Hata: Gömülü derleyici (demo) sadece temel Serial.read() kodunu destekler.";
        statusLbl.style.color = "#ff5252";
        btnUpload.disabled = true;
        btnUpload.style.background = "#555";
        btnUpload.style.cursor = "not-allowed";
        return;
    }

    compiledHexCode = UNIVERSAL_HEX; 
    statusLbl.innerText = "Durum: BAŞARILI! Kod yüklenebilir.";
    statusLbl.style.color = "#00e676";
    btnUpload.disabled = false;
    btnUpload.style.background = "#ff9800";
    btnUpload.style.cursor = "pointer";
    btnUpload.classList.remove('off');
}

// ==========================================
// 4. IOT: YÜKLEME (AVRgirl)
// ==========================================
async function runUploader(hexDataToUse = null) {
    const hexToFlash = hexDataToUse || compiledHexCode;

    if (!hexToFlash) {
        alert("Önce kodu derleyiniz.");
        return;
    }
    
    if (serialPort) {
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
                        badge.innerHTML = '<i class="fas fa-check"></i> Yüklendi';
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
// 5. IOT: TEST FIRMWARE YÜKLEME (Sunucusuz)
// ==========================================
async function runQuickTest() {
    const btn = document.getElementById('btnQuickTest');
    
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Hazırlanıyor...';
    }

    setTimeout(async () => {
        if(btn) btn.innerHTML = '<i class="fas fa-microchip"></i> Yükleniyor...';
        await runUploader(UNIVERSAL_HEX);
    }, 500);
}

// ==========================================
// 6. IOT: BAĞLANTI & KONTROL
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
            document.getElementById('serialConsole').innerHTML += `<br>> Komut Gönderildi: YAK (1)`;
        }
        else if (command === 'OFF') {
            await serialWriter.write("0");
            document.getElementById('serialConsole').innerHTML += `<br>> Komut Gönderildi: SÖNDÜR (0)`;
        }
        else if (command === 'BLINK') {
            document.getElementById('serialConsole').innerHTML += `<br>> Komut Başlatıldı: BLINK...`;
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
// 7. BLOCKLY ENTEGRASYONU VE KOD ÜRETİMİ (C++)
// ==========================================
function initBlockly() {
    if (blocklyWorkspace || typeof Blockly === 'undefined') {
        console.warn("Blockly zaten yüklü veya kütüphane eksik.");
        return;
    }
    
    // ToolBox XML içeriği
    const toolboxXml = `
        <xml id="toolbox" style="display: none">
            <category name="Kontrol" colour="#FFD700">
                <block type="controls_if"></block>
                <block type="controls_repeat_ext">
                    <value name="TIMES">
                        <shadow type="math_number">
                            <field name="NUM">10</field>
                        </shadow>
                    </value>
                </block>
                <block type="logic_compare"></block>
            </category>
            <category name="Arduino Pin" colour="#00A2E8">
                <block type="digital_write"></block>
                <block type="pin_delay"></block>
            </category>
            <category name="Giriş/Çıkış" colour="#4C97FF">
                <block type="pin_mode"></block>
                <block type="serial_print"></block>
            </category>
        </xml>
    `;
    
    blocklyWorkspace = Blockly.inject('blocklyDiv', {
        toolbox: toolboxXml,
        scrollbars: true,
        trashcan: true,
        horizontalLayout: false,
        zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2
        }
    });

    // --- ÖZEL ARDUINO BLOK TANIMLARI ---
    
    // Pin Mode
    Blockly.Blocks['pin_mode'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("Pin")
                .appendField(new Blockly.FieldNumber(13, 0, 13), "PIN")
                .appendField("ayarla")
                .appendField(new Blockly.FieldDropdown([["OUTPUT", "OUTPUT"], ["INPUT", "INPUT"]]), "MODE");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
            this.setTooltip("Pin'i giriş veya çıkış olarak ayarlar.");
        }
    };
    Blockly.JavaScript['pin_mode'] = function(block) {
        var pin = block.getFieldValue('PIN');
        var mode = block.getFieldValue('MODE');
        var code = `pinMode(${pin}, ${mode});\n`;
        return code;
    };

    // Digital Write
    Blockly.Blocks['digital_write'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("Pin")
                .appendField(new Blockly.FieldNumber(13, 0, 13), "PIN")
                .appendField("durumu")
                .appendField(new Blockly.FieldDropdown([["HIGH", "HIGH"], ["LOW", "LOW"]]), "STATE");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
            this.setTooltip("Dijital pinin durumunu ayarlar (YÜKSEK/DÜŞÜK).");
        }
    };
    Blockly.JavaScript['digital_write'] = function(block) {
        var pin = block.getFieldValue('PIN');
        var state = block.getFieldValue('STATE');
        var code = `digitalWrite(${pin}, ${state});\n`;
        return code;
    };
    
    // Pin Delay (Gecikme)
    Blockly.Blocks['pin_delay'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("bekle (ms)")
                .appendField(new Blockly.FieldNumber(1000, 0), "DURATION");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(180);
            this.setTooltip("Belirtilen süre kadar bekler.");
        }
    };
    Blockly.JavaScript['pin_delay'] = function(block) {
        var duration = block.getFieldValue('DURATION');
        var code = `delay(${duration});\n`;
        return code;
    };
    
    // Kod güncellendiğinde C++ çıktısını göster
    function updateCode(event) {
        if (event.isUi || event.type == Blockly.Events.VIEWPORT_CHANGE) {
            return;
        }
        let generatedCode = Blockly.JavaScript.workspaceToCode(blocklyWorkspace);
        
        // Setup ve Loop yapısını ekleyerek tam Arduino kodu oluşturma (Çok Basitleştirilmiş)
        if(generatedCode) {
            // Sadece PinMode'ları setup'a al
            const setupCode = generatedCode.match(/pinMode\([^;]*;\n/g)?.join('\n') || "";
            // Geri kalanını loop'a al
            const loopCode = generatedCode.replace(/pinMode\([^;]*;\n/g, '');

            generatedCode = `void setup() {\n  // Başlangıç ayarları\n${setupCode}\n}\n\nvoid loop() {\n  // Sürekli çalışan kod\n${loopCode}}`;
        }

        document.getElementById('generatedCode').innerText = generatedCode || "// Blokları buraya sürükle...";
    }
    
    blocklyWorkspace.addChangeListener(updateCode);
    
    // Başlangıçta örnek bir kod ekle (Blink)
    const initialXml = `<xml xmlns="https://developers.google.com/blockly/xml">
        <block type="pin_mode" id="init_pin" x="20" y="20">
            <field name="PIN">13</field>
            <field name="MODE">OUTPUT</field>
            <next>
                <block type="controls_repeat_ext" id="loop" inline="false">
                    <value name="TIMES">
                        <shadow type="math_number">
                            <field name="NUM">99999</field>
                        </shadow>
                    </value>
                    <statement name="DO">
                        <block type="digital_write">
                            <field name="PIN">13</field>
                            <field name="STATE">HIGH</field>
                            <next>
                                <block type="pin_delay">
                                    <field name="DURATION">500</field>
                                    <next>
                                        <block type="digital_write">
                                            <field name="PIN">13</field>
                                            <field name="STATE">LOW</field>
                                            <next>
                                                <block type="pin_delay">
                                                    <field name="DURATION">500</field>
                                                </block>
                                            </next>
                                        </block>
                                    </next>
                                </block>
                            </next>
                        </block>
                    </statement>
                </block>
            </next>
        </block>
    </xml>`;
    Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(initialXml), blocklyWorkspace);

    // İlk kodu oluştur ve göster
    updateCode({});
}

// =adan=======================================
// 8. OYUNLAR (SNAKE, TETRIS, MAZE)
// ==========================================
let canvas = document.getElementById('gameCanvas');
let ctx = canvas ? canvas.getContext('2d') : null;
let gameInterval, currentGame, score = 0;

function stopCurrentGame() {
    if(!ctx) return;
    clearInterval(gameInterval);
    ctx.clearRect(0, 0, 400, 400);
    currentGame = null;
}

function startGame(t, b) {
    if(!ctx) return;
    stopCurrentGame();
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
        for (let y = 0; y < 7; y++) for (let x = 0; x < 10; x++) { if (map[y][x] == 1) { ctx.fillStyle = '#03c'; ctx.fillRect(x * 40, y * 40, 40, 40); } else if (map[y][x] == 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x * 40 + 20, p.y * 40 + 20, 4, 0, 6.28); ctx.fill(); } }
        ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(p.x * 40 + 20, p.y * 40 + 20, 15, 0.6, 5.6); ctx.fill(); ctx.fillStyle = '#f00'; ctx.fillRect(g.x * 40 + 5, g.y * 40 + 5, 30, 30);
    }
    gameInterval = setInterval(() => {
        if (Math.random() > 0.5) {
            let m = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter(d => map[g.y + d.y][g.x + d.x] != 1);
            if (m.length) { let nm = m[Math.floor(Math.random() * m.length)]; g.x += nm.x; g.y += nm.y; }
        }
        if (p.x == g.x && p.y == g.y) { score = 0; p = { x: 1, y: 1 }; g = { x: 8, y: 5 }; alert("Yakaladın!"); } draw();
    }, 500);
    document.onkeydown = e => {
        if (currentGame !== 'maze') return;
        let nx = p.x, ny = p.y;
        if (e.keyCode == 37) nx--; if (e.keyCode == 39) nx++; if (e.keyCode == 38) ny--; if (e.keyCode == 40) ny++;
        if (map[ny][nx] != 1) { p.x = nx; p.y = ny; if (map[ny][nx] == 0) { score += 10; map[ny][nx] = 2; document.getElementById('scoreBoard').innerText = "SKOR: " + score; } } draw();
        if ([37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
    };
    draw();
}
