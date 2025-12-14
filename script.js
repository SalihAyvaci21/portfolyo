// --- NAVİGASYON ---
function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id !== 'games') stopCurrentGame(); 
}

// --- GITHUB REPO ---
async function fetchGithubRepos() {
    const username = 'SalihAyvaci21';
    const container = document.getElementById('repos-container');
    const gizlenecekler = ["SalihAyvaci21", "portfolyo"]; // Filtrelenecekler
    
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
// WEB SERIAL API (KONTROL & YÜKLEME)
// ==========================================
let port, writer, blinkInterval;

async function connectSerial() {
    if (!navigator.serial) { logConsole("⚠️ Web Serial desteklenmiyor."); return; }
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();
        
        logConsole("✅ Bağlandı! Blokları kullanabilirsin.");
        updateUI(true);
    } catch (err) {
        if(err.name === "NotFoundError") logConsole("⚠️ Cihaz seçilmedi.");
        else logConsole("❌ Hata: " + err);
        updateUI(false);
    }
}

async function disconnectSerial() {
    try {
        if(writer) { await writer.releaseLock(); writer=null; }
        if(port) { await port.close(); port=null; }
        if(blinkInterval) { clearInterval(blinkInterval); blinkInterval=null; }
        logConsole("🔌 Kesildi.");
    } catch(e) { logConsole("⚠️ Hata."); }
    updateUI(false);
}

function updateUI(connected) {
    document.getElementById('btnConnect').style.display = connected ? 'none' : 'inline-block';
    document.getElementById('btnDisconnect').style.display = connected ? 'inline-block' : 'none';
    const badge = document.getElementById('statusBadge');
    if(connected) { badge.innerHTML='<i class="fas fa-check-circle"></i> Bağlandı'; badge.classList.add('connected'); }
    else { badge.innerHTML='<i class="fas fa-circle"></i> Bağlantı Yok'; badge.classList.remove('connected'); }
}

async function sendCommand(cmd) {
    if(!writer) { logConsole("⚠️ Önce bağlayın!"); return; }
    try { await writer.write(cmd + "\n"); logConsole("📤 " + cmd); }
    catch(e) { logConsole("❌ İletim hatası"); disconnectSerial(); }
}

// FIRMWARE YÜKLEME (HEX)
async function uploadHex() {
    const btn = document.getElementById('btnUpload');
    // Kütüphane Yüklendi mi?
    if (typeof window.AvrgirlArduino === 'undefined') {
        logConsole("❌ Kütüphane (library.js) bulunamadı! Dosyayı indirdiniz mi?");
        return;
    }
    if(!confirm("Arduino Uno'ya kod yüklenecek. Onaylıyor musun?")) return;

    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        logConsole("⏳ HEX indiriliyor...");
        const response = await fetch('firmware.hex');
        if (!response.ok) throw new Error("firmware.hex bulunamadı!");
        const hexData = await response.arrayBuffer();

        logConsole("⏳ Yükleniyor... (Kabloyu çekme!)");
        const avrgirl = new AvrgirlArduino({ board: 'uno', debug: true });
        avrgirl.flash(hexData, (error) => {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-microchip"></i> Firmware Yükle';
            if (error) logConsole("❌ Başarısız: " + error);
            else { logConsole("✅ YÜKLENDİ! Şimdi bağlanabilirsin."); alert("Yükleme Başarılı!"); }
        });
    } catch (e) { logConsole("❌ Hata: " + e.message); btn.disabled = false; btn.innerHTML = '<i class="fas fa-microchip"></i> Firmware Yükle'; }
}

function runBlock(action) {
    if(action==='ON') sendCommand(`PIN:${document.getElementById('pinSelectOn').value}:1`);
    if(action==='OFF') sendCommand(`PIN:${document.getElementById('pinSelectOff').value}:0`);
}

function toggleBlink() {
    if(blinkInterval) { clearInterval(blinkInterval); blinkInterval=null; logConsole("⏹️ Blink Durdu"); }
    else {
        if(!writer) return logConsole("⚠️ Bağlı değil!");
        let pin=document.getElementById('pinSelectBlink').value, s=1;
        logConsole("▶️ Blink Başladı");
        blinkInterval = setInterval(() => { sendCommand(`PIN:${pin}:${s}`); s=s===1?0:1; }, 1000);
    }
}

function logConsole(msg) {
    const c = document.getElementById('serialConsole');
    c.innerHTML = `<div>> ${msg}</div>` + c.innerHTML;
}

// ==========================================
// OYUNLAR (SNAKE, TETRIS, MAZE)
// ==========================================
let canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d'), gameInterval, currentGame, score=0;

function stopCurrentGame() { clearInterval(gameInterval); ctx.clearRect(0,0,400,400); currentGame=null; }
function startGame(t,b) { stopCurrentGame(); document.querySelectorAll('.game-card').forEach(c=>c.classList.remove('active-game')); b.classList.add('active-game'); score=0; document.getElementById('scoreBoard').innerText="SKOR: 0"; if(t==='snake') initSnake(); if(t==='tetris') initTetris(); if(t==='maze') initMaze(); }

// 1. SNAKE
function initSnake() {
    currentGame='snake'; let snake=[{x:10,y:10}], apple={x:15,y:15}, xv=0, yv=0;
    document.onkeydown=e=>{ if(currentGame!=='snake')return; if(e.keyCode==37&&xv!=1){xv=-1;yv=0} if(e.keyCode==38&&yv!=1){xv=0;yv=-1} if(e.keyCode==39&&xv!=-1){xv=1;yv=0} if(e.keyCode==40&&yv!=-1){xv=0;yv=1} if([37,38,39,40].includes(e.keyCode))e.preventDefault(); };
    gameInterval=setInterval(()=>{
        let h={x:snake[0].x+xv,y:snake[0].y+yv}; if(h.x<0)h.x=19; if(h.x>19)h.x=0; if(h.y<0)h.y=19; if(h.y>19)h.y=0;
        for(let i=0;i<snake.length;i++)if(snake[i].x==h.x&&snake[i].y==h.y){score=0;snake=[{x:10,y:10}];xv=0;yv=0;}
        snake.unshift(h); if(h.x==apple.x&&h.y==apple.y){score+=10;document.getElementById('scoreBoard').innerText="SKOR: "+score;apple={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)};}else snake.pop();
        ctx.fillStyle='#000';ctx.fillRect(0,0,400,400); ctx.fillStyle='#ff0055';ctx.fillRect(apple.x*20,apple.y*20,18,18); ctx.fillStyle='#00ff88';for(let p of snake)ctx.fillRect(p.x*20,p.y*20,18,18);
    },100);
}
// 2. TETRIS
function initTetris() {
    currentGame='tetris'; let board=Array(20).fill().map(()=>Array(10).fill(0)), piece={m:[[[1]]],x:3,y:0,c:'#fff'};
    const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[1,1,1],[0,1,0]],[[1,1,1],[1,0,0]],[[1,1,0],[0,1,1]]];
    function newPiece(){piece={m:SHAPES[Math.floor(Math.random()*5)],x:3,y:0,c:['#0f8','#f05','#70f'][Math.floor(Math.random()*3)]}; if(collide())board.forEach(r=>r.fill(0));}
    function collide(){ return piece.m.some((r,y)=>r.some((v,x)=>v&&(board[y+piece.y]&&board[y+piece.y][x+piece.x])!==0)); }
    function draw(){ ctx.fillStyle='#000';ctx.fillRect(0,0,400,400); ctx.strokeStyle='#333';ctx.strokeRect(100,0,200,400);
        board.forEach((r,y)=>r.forEach((v,x)=>{if(v){ctx.fillStyle='#333';ctx.fillRect(x*20+100,y*20,19,19);}}));
        piece.m.forEach((r,y)=>r.forEach((v,x)=>{if(v){ctx.fillStyle=piece.c;ctx.fillRect((x+piece.x)*20+100,(y+piece.y)*20,19,19);}})); }
    function update(){ piece.y++; if(collide()){piece.y--; piece.m.forEach((r,y)=>r.forEach((v,x)=>{if(v)board[y+piece.y][x+piece.x]=1;})); 
        for(let y=19;y>0;y--)if(board[y].every(x=>x)){board.splice(y,1);board.unshift(Array(10).fill(0));score+=100;y++;} newPiece();} draw(); }
    newPiece(); gameInterval=setInterval(update,500);
    document.onkeydown=e=>{ if(currentGame!=='tetris')return; if(e.keyCode==37){piece.x--;if(collide())piece.x++} if(e.keyCode==39){piece.x++;if(collide())piece.x--} if(e.keyCode==40)update(); 
        if(e.keyCode==38){let old=piece.m;piece.m=piece.m[0].map((_,i)=>piece.m.map(r=>r[i]).reverse());if(collide())piece.m=old;} draw(); if([37,38,39,40].includes(e.keyCode))e.preventDefault(); };
}
// 3. MAZE
function initMaze() {
    currentGame='maze'; let map=[[1,1,1,1,1,1,1,1,1,1],[1,0,0,0,1,0,0,0,0,1],[1,0,1,0,1,0,1,1,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,1,1,1,1,1,1,0,1],[1,0,0,0,0,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1]];
    let p={x:1,y:1}, g={x:8,y:5};
    function draw(){ ctx.fillStyle='#000';ctx.fillRect(0,0,400,400); 
        for(let y=0;y<7;y++)for(let x=0;x<10;x++){ if(map[y][x]==1){ctx.fillStyle='#03c';ctx.fillRect(x*40,y*40,40,40);} else if(map[y][x]==0){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x*40+20,y*40+20,4,0,6.28);ctx.fill();} }
        ctx.fillStyle='#ff0';ctx.beginPath();ctx.arc(p.x*40+20,p.y*40+20,15,0.6,5.6);ctx.fill(); ctx.fillStyle='#f00';ctx.fillRect(g.x*40+5,g.y*40+5,30,30); }
    gameInterval=setInterval(()=>{ 
        if(Math.random()>0.5){ let m=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].filter(d=>map[g.y+d.y][g.x+d.x]!=1); 
        if(m.length){let nm=m[Math.floor(Math.random()*m.length)]; g.x+=nm.x; g.y+=nm.y;} }
        if(p.x==g.x&&p.y==g.y){score=0;p={x:1,y:1};g={x:8,y:5};alert("Yakaladın!");} draw(); },500);
    document.onkeydown=e=>{ if(currentGame!=='maze')return; let nx=p.x, ny=p.y; if(e.keyCode==37)nx--; if(e.keyCode==39)nx++; if(e.keyCode==38)ny--; if(e.keyCode==40)ny++;
        if(map[ny][nx]!=1){p.x=nx;p.y=ny; if(map[ny][nx]==0){score+=10;map[ny][nx]=2;document.getElementById('scoreBoard').innerText="SKOR: "+score;}} draw(); if([37,38,39,40].includes(e.keyCode))e.preventDefault(); };
    draw();
}
