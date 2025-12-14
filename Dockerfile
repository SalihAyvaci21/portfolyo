# 1. Aşama: Gerekli araçları kurmak için temel imaj
FROM node:18-slim as builder

# Arduino CLI'ı indirmek için bağımlılıkları yükle
RUN apt-get update && \
    apt-get install -y wget curl unzip libstdc++6 && \
    rm -rf /var/lib/apt/lists/*

# Arduino CLI'ı indir ve kur (En son stabil versiyonu kullanın)
# Güncel versiyon için Arduino CLI GitHub sayfasını kontrol edebilirsiniz.
ARG ARDUINO_CLI_VERSION="0.35.2"
ENV ARDUINO_CLI_URL="https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz"

RUN wget ${ARDUINO_CLI_URL} -O /tmp/arduino-cli.tar.gz && \
    tar -xf /tmp/arduino-cli.tar.gz -C /usr/bin/ && \
    rm /tmp/arduino-cli.tar.gz

# Arduino CLI ayarlarını ve çekirdek (core) dosyalarını ayarla

# Varsayılan konfigürasyon dosyası oluştur
RUN arduino-cli config init

# avr (Arduino Uno vb.) çekirdeğini yükle
# Bu işlem biraz zaman alabilir.
RUN arduino-cli core update-index
RUN arduino-cli core install arduino:avr

# 2. Aşama: Uygulama kodunu ekle ve Node.js sunucusunu çalıştır
FROM node:18-slim

# Önceki aşamadan Arduino CLI ve core dosyalarını kopyala
COPY --from=builder /usr/bin/arduino-cli /usr/bin/arduino-cli
COPY --from=builder /root/.arduino15 /root/.arduino15

# Uygulama için gerekli dosyaları kopyala
WORKDIR /usr/src/app
COPY package.json .
RUN npm install

# Server kodunu kopyala
COPY server.js .

# Sunucunun dinleyeceği portu ayarla (Render için genellikle 10000 veya özel bir port)
ENV PORT 3000
EXPOSE 3000

# Uygulamayı başlat
CMD ["node", "server.js"]