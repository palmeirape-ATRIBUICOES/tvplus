FROM node:20-slim

# Instala as dependências do sistema necessárias para rodar o Puppeteer (Chromium headless)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configura as variáveis de ambiente para que o Puppeteer ignore o download do Chromium
# e utilize a instalação do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Define o diretório de trabalho interno do container
WORKDIR /app

# Copia os arquivos de configuração de pacotes primeiro
COPY package*.json ./

# Instala as dependências de produção do Node.js
RUN npm install --production

# Copia o código fonte do projeto
COPY . .

# Cria a pasta padrão onde o disco persistente do SQLite será montado
RUN mkdir -p /data

# Expõe a porta padrão do Express
EXPOSE 3000

# Variáveis padrão de ambiente no container
ENV PORT=3000 \
    DATABASE_PATH=/data/database.sqlite \
    NODE_ENV=production

# Comando para rodar a aplicação
CMD ["node", "server.js"]
