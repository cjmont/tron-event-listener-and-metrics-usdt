# TRON Event Listener and Metrics

Este proyecto es una aplicación Node.js que escucha eventos de la blockchain de TRON y registra depósitos en una base de datos MySQL. La aplicación también expone métricas de rendimiento y estado mediante Prometheus y Grafana.

## Requisitos Previos

- Node.js
- MySQL
- Docker y Docker Compose

## Instalación

1. Clona este repositorio:

   ```sh
   git clone [<url_del_repositorio>](https://github.com/cjmont/tron-event-listener-and-metrics-usdt)
   cd tron-event-listener-and-metrics-usdt
   ```

2. Instala las dependencias:

   ```sh
   npm install
   ```

3. Configura las variables de entorno. Crea un archivo `.env` en el directorio raíz del proyecto y agrega las siguientes variables:

   ```env
   PORT=3007
   TRON_API_KEY=<tu_tron_api_key>
   TRON_NODE=<tu_tron_node_url>
   DB_HOST=<tu_db_host>
   DB_USER=<tu_db_user>
   DB_PASSWORD=<tu_db_password>
   DB_NAME=<tu_db_name>
   PRIVATE_KEY=<tu_private_key>
   ```

4. Configura Prometheus. Crea un archivo `prometheus.yml` en el directorio raíz del proyecto con el siguiente contenido:

   ```yaml
   global:
     scrape_interval: 15s
   scrape_configs:
     - job_name: 'node'
       static_configs:
         - targets: ['app:3007']
   ```

## Ejecución

Para iniciar la aplicación junto con Prometheus y Grafana, ejecuta:

```sh
docker-compose up -d
```

La aplicación estará disponible en `http://localhost:3007`.

## Endpoints

### `/metrics`

Devuelve las métricas de Prometheus.

```sh
GET /metrics
```

## Métricas

La aplicación expone varias métricas que se pueden monitorear con Prometheus:

- `http_request_duration_ms`: Duración de las solicitudes HTTP en milisegundos.
- `db_query_duration_seconds`: Duración de las consultas a la base de datos en segundos.
- `db_query_count`: Número total de consultas a la base de datos ejecutadas.
- `db_query_errors_count`: Número total de errores en las consultas a la base de datos.
- `processed_events_count`: Número total de eventos de blockchain procesados.
- `event_processing_errors_count`: Número de errores en el procesamiento de eventos de blockchain.
- `memory_usage_bytes`: Uso de memoria de la aplicación en bytes.
- `api_latency_seconds`: Latencia de las solicitudes a la API externa en segundos.
- `http_response_size_bytes`: Tamaño de las respuestas HTTP en bytes.

## Visualización con Grafana

Para visualizar las métricas en Grafana:

1. Accede a Grafana en `http://localhost:3000`.
2. Inicia sesión con las credenciales `admin`/`admin` (o las credenciales configuradas).
3. Agrega Prometheus como fuente de datos:
   - Ve a **Configuration** > **Data Sources** > **Add data source**.
   - Selecciona **Prometheus**.
   - Configura la URL como `http://prometheus:9090`.
   - Guarda y prueba la conexión.
4. Crea dashboards para visualizar las métricas:
   - Ve a **Create** > **Dashboard** > **Add new panel**.
   - Selecciona las métricas que deseas visualizar y personaliza los gráficos según tus necesidades.

## Estructura del Código

### `index.js`

Este es el archivo principal que configura y arranca la aplicación.

- Configura las variables de entorno utilizando `dotenv`.
- Inicializa las métricas de Prometheus.
- Configura la conexión a la base de datos MySQL.
- Define el endpoint `/metrics`.
- Escucha eventos de la blockchain de TRON.
- Procesa transacciones y las registra en la base de datos.
- Monitorea el rendimiento de las consultas a la base de datos y el procesamiento de eventos.

### Funciones Principales

#### `executeQuery(query, params)`

Envuelve las consultas a la base de datos para medir su duración y contar los errores.

#### `fetchEvents()`

Obtiene eventos de la blockchain de TRON y procesa cada uno.

#### `processTransaction(event)`

Procesa una transacción específica y la registra en la base de datos si es necesaria.

#### `isAddressMonitored(to_address_hex)`

Verifica si una dirección está siendo monitoreada.

## Monitoreo y Visualización

Para visualizar las métricas, puedes usar Grafana junto con Prometheus como se describió anteriormente.

## Mantenimiento

### Logs

Los depósitos se registran en el archivo `deposits-log.txt` en el directorio raíz del proyecto.

### Depuración

Para depurar la aplicación, puedes usar cualquier herramienta de depuración de Node.js como `node-inspect`.

## Contribuciones
 
• Freddy Andrade L. 
• Freed Carrera 
• José Castillo N. 
• Vanessa Llongo G. 
• Carlos Montaño 
• Diana Paladines
• Steeven Alcívar R.

Las contribuciones son bienvenidas. Por favor, abre un issue o un pull request para sugerencias y mejoras.

## Licencia

Este proyecto está bajo la licencia MIT. Consulta el archivo `LICENSE` para más detalles.

---

¡Gracias por usar nuestro TRON Event Listener and Metrics! Si tienes alguna pregunta o problema, no dudes en abrir un issue.
