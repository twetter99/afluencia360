# Afluencia360 - Dashboard de Afluencia de Personas

Dashboard profesional para visualizar datos de afluencia de personas (conteo, demografía, flujo de pasajeros) 
con subida diaria vía Excel.

## 🏗️ Arquitectura

```
API/
├── backend/               # API Express + Firestore
│   ├── server.js          # Servidor Express
│   ├── config/
│   │   └── firebase.js    # Configuración Firestore + operaciones de datos
│   ├── routes/
│   │   ├── upload.js      # Endpoint subida de Excel
│   │   └── data.js        # Endpoints de consulta de datos
│   └── utils/
│       ├── excelParser.js # Parseador inteligente de Excel
│       └── generateTemplate.js  # Generador de plantilla Excel
│
└── frontend/              # React + Vite + Tailwind CSS + Recharts
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── Header.jsx        # Header con selector de entidad y filtros
        │   ├── Dashboard.jsx     # Layout principal
        │   ├── KPICards.jsx      # Tarjetas de KPIs principales
        │   ├── GenderChart.jsx   # Gráfico de dona género
        │   ├── AgeChart.jsx      # Gráfico de barras edad
        │   ├── FlowKPI.jsx       # KPIs flujo de pasajeros
        │   ├── TrendChart.jsx    # Gráfico de tendencia temporal
        │   └── UploadExcel.jsx   # Modal de subida de Excel
        └── services/
            └── api.js            # Cliente API
```

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configurar Firebase (Opcional)

Si deseas usar Firestore:

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Ve a **Configuración del Proyecto > Cuentas de servicio**
3. Genera una nueva clave privada (JSON)
4. Guarda el archivo como `backend/config/serviceAccountKey.json`
5. Copia `.env.example` a `.env` y configura las variables

```bash
cd backend
cp .env.example .env
# Edita .env con tu configuración
```

> **Nota:** Sin Firebase configurado, la app funciona en modo local usando memoria RAM. 
> Los datos se perderán al reiniciar el servidor. Ideal para pruebas.

### 3. Generar plantilla Excel

```bash
cd backend
npm run generate-template
```

Esto genera `plantilla_afluencia360.xlsx` con las columnas correctas y datos de ejemplo.

### 4. Ejecutar

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Abre http://localhost:5173 en tu navegador.

## 📊 Datos que procesa

| Categoría | Campos |
|---|---|
| **Conteo** | Adultos, Niños, Deduplicados, Total, Empleados Heavy |
| **Permanencia** | Tiempo total de residencia (HH:MM:SS) |
| **Género** | Hombre, Mujer, Desconocido |
| **Edad** | 0-9, 10-16, 17-30, 31-45, 46-60, 60+, Desconocido |
| **Edad Heavy** | Mismos rangos para visitantes frecuentes |
| **KPI Flujo** | Ayer, Semana, Mes, Año + Chain Index + YOY |

## 📁 Formato del Excel

Usa la plantilla generada o crea un Excel con estas columnas:

| Columna | Tipo | Ejemplo |
|---|---|---|
| Fecha | YYYY-MM-DD | 2026-02-11 |
| Entidad | Texto | Marquesinas Aranjuez |
| Adultos | Número | 6409 |
| Niños | Número | 1616 |
| Deduplicados | Número | 1050 |
| Número Total | Número | 9811 |
| Empleados Heavy | Número | 0 |
| Tiempo Residencia | HH:MM:SS | 02:13:31 |
| Género Hombre | Número | 3670 |
| Género Mujer | Número | 2753 |
| (ver plantilla para todas las columnas) | | |

## 🔄 Flujo de trabajo diario

1. Descarga los datos de tu web fuente
2. Rellena el Excel con la plantilla
3. Abre el Dashboard → Subir Excel
4. Los datos se procesan y almacenan automáticamente
5. El dashboard se actualiza con los nuevos datos

## 🛠️ API Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/upload` | Subir archivo Excel |
| `POST` | `/api/upload/preview` | Previsualizar sin guardar |
| `GET` | `/api/data/entities` | Listar entidades |
| `GET` | `/api/data/records` | Obtener registros (con filtros) |
| `GET` | `/api/data/latest/:entity` | Último registro de una entidad |
| `GET` | `/api/data/summary` | Resumen/agregados |
| `GET` | `/api/data/dashboard/:entity` | Datos completos para dashboard |
| `DELETE` | `/api/data/records/:id` | Eliminar registro |

## 📦 Tecnologías

- **Backend:** Node.js, Express, Firebase Admin SDK, multer, xlsx
- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Axios, react-dropzone
- **Base de Datos:** Firebase Firestore (o modo local en memoria)
