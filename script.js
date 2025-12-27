let compiledHexCode = null;
let serialPort = null;
let serialWriter = null;

// Sayfa Değiştirme
function showSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// GitHub Projeleri
async function fetchGithubRepos() {
    const container = document.getElementById('repos-container');
    try {
        const res = await fetch('https://api.github.com/users/SalihAyvaci21/repos?sort=pushed');
        const repos = await res.json();
        container.innerHTML = repos.slice(0, 6).map(repo => `
            <div class="card">
                <h3>${repo.name}</h3>
                <p>${repo.description || "Proje detayı..."}</p>
                <a href="${repo.html_url}" target="_blank" style="color:var(--primary)">Koda Git</a>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = "Veri çekilemedi."; }
}

// ARDUINO DERLEME (BACKEND'E GİDEN KISIM)
async function compileCode() {
    const statusLbl = document.getElementById('statusLabelNew');
    const code = document.getElementById('cppEditor').value;
    statusLbl.innerText = "Sunucuda derleniyor... (30-40sn sürebilir)";
    
    try {
        const response = await fetch('https://arduino-backend-et1z.onrender.com/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });
        const data = await response.json();
        if(data.hex) {
            compiledHexCode = data.hex;
            statusLbl.innerText = "Derleme Başarılı! Şimdi yükleyebilirsiniz.";
            statusLbl.style.color = "#00ff88";
            document.getElementById('btnUploadNew').disabled = false;
            document.getElementById('btnUploadNew').classList.remove('off');
        } else {
            statusLbl.innerText = "Hata: " + data.error;
        }
    } catch (e) { statusLbl.innerText = "Bağlantı hatası!"; }
}

// ARDUINO'YA YÜKLEME (AVRGIRL)
async function runUploader() {
    const avrgirl = new AvrgirlArduino({ board: 'uno', debug: true });
    const blob = new Blob([compiledHexCode], { type: 'text/plain' });
    const reader = new FileReader();
    reader.onload = function() {
        avrgirl.flash(reader.result, (err) => {
            if (err) alert("Yükleme Hatası: " + err);
            else alert("BAŞARIYLA YÜKLENDİ!");
        });
    };
    reader.readAsArrayBuffer(blob);
}

// SERİ PORT BAĞLANTISI (BLOKLAR İÇİN)
async function connectSerial() {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });
    const encoder = new TextEncoderStream();
    encoder.readable.pipeTo(serialPort.writable);
    serialWriter = encoder.writable.getWriter();
    document.getElementById('statusBadge').innerText = "Bağlandı";
}

async function runBlock(cmd) {
    if(!serialWriter) return alert("Önce Bağlan!");
    await serialWriter.write(cmd === 'ON' ? "1" : "0");
}

window.onload = fetchGithubRepos;
