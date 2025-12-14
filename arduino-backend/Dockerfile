# 1. Aşama: Gerekli araçları kurmak için temel imaj
FROM node:18-slim as builder

# Gerekli bağımlılıkları yükle
RUN apt-get update && \
    apt-get install -y wget curl unzip libstdc++6 && \
    rm -rf /var/lib/apt/lists/*

# Arduino CLI'ı indir ve kur
ARG ARDUINO_CLI_VERSION="0.35.2"
ENV ARDUINO_CLI_URL="https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz"

RUN wget ${ARDUINO_CLI_URL} -O /tmp/arduino-cli.tar.gz && \
    tar -xf /tmp/arduino-cli.tar.gz -C /usr/bin/ && \
    rm /tmp/arduino-cli.tar.gz

# ==================================================
# CLI Konfigürasyonu (root kullanıcısının varsayılan dizini)
# ==================================================
# ARDUINO_USER_DIR'ı belirterek dosyaların nerede olduğunu netleştiriyoruz
ENV ARDUINO_USER_DIR=/usr/share/.arduino15 
ENV ARDUINO_CLI_HOME=/usr/share/.arduino15 

RUN mkdir -p ${ARDUINO_USER_DIR}
RUN arduino-cli config init --config-file ${ARDUINO_USER_DIR}/arduino-cli.yaml

# Çekirdek Kurulumu
RUN arduino-cli core update-index --config-file ${ARDUINO_USER_DIR}/arduino-cli.yaml
RUN arduino-cli core install arduino:avr --config-file ${ARDUINO_USER_DIR}/arduino-cli.yaml
# ==================================================

# 2. Aşama: Uygulama kodunu ekle
FROM node:18-slim

# Önceki aşamadan CLI ve core dosyalarını KESİN YOLDAN kopyala
ENV ARDUINO_USER_DIR=/usr/share/.arduino15
COPY --from=builder /usr/bin/arduino-cli /usr/bin/arduino-cli
# Düzgün kurulmuş dosyaları kopyala
COPY --from=builder ${ARDUINO_USER_DIR} ${ARDUINO_USER_DIR} 

# Uygulama kodunu kopyala ve başlat
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
COPY server.js .

ENV PORT 3000
EXPOSE 3000

CMD ["node", "server.js"]
