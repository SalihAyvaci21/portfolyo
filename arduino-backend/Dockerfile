# Node.js tabanlı bir Linux imajı kullan
FROM node:18-bullseye

# Gerekli sistem araçlarını yükle
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Arduino CLI Kurulumu
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh

# Arduino AVR Çekirdeğini İndir (Uno için gerekli)
RUN arduino-cli core update-index
RUN arduino-cli core install arduino:avr

# Çalışma klasörünü ayarla
WORKDIR /app

# Paket listesini kopyala ve yükle
COPY package.json ./
RUN npm install

# Sunucu dosyasını kopyala
COPY server.js ./

# Geçici derleme klasörü oluştur
RUN mkdir sketch_temp

# Sunucuyu başlat
CMD ["node", "server.js"]