# Usa una versión específica de Node.js basada en Alpine por ser más ligera
FROM node:16-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos de definición de dependencias
COPY package*.json ./

# Instala las dependencias, usando `npm ci` para instalaciones más limpias y repetibles
RUN npm ci --only=production

# Copia el resto del código fuente al directorio de trabajo
COPY . .

# Expone el puerto que utiliza tu aplicación, cambia si es necesario
EXPOSE 3000

# Ejecuta tu script principal al iniciar el contenedor
CMD ["node", "deposit_trondb.js"]