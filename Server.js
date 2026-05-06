// ─────────────────────────────────────────────
// Server.js — El Punto de la Arepa
// Adaptado para PostgreSQL (Render)
// ─────────────────────────────────────────────
const express = require("express");
const { Pool } = require("pg");
const cors    = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// CONEXIÓN A PostgreSQL
// Render provee una sola variable: DATABASE_URL
// ─────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }  // requerido por Render
});

// Crear tabla al arrancar si no existe
async function createTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id        SERIAL PRIMARY KEY,
                nombre    VARCHAR(100)  NOT NULL,
                telefono  VARCHAR(20)   NOT NULL,
                email     VARCHAR(100),
                direccion TEXT          NOT NULL,
                items     TEXT          NOT NULL,
                total     INTEGER       NOT NULL,
                estado    VARCHAR(50)   DEFAULT 'pendiente',
                fecha     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ Tabla 'pedidos' lista");
    } catch (err) {
        console.error("Error creando tabla:", err.message);
    }
}

// Conectar y crear tabla al iniciar
pool.connect((err) => {
    if (err) {
        console.error("Error conectando a PostgreSQL:", err.message);
    } else {
        console.log("✅ Conectado a PostgreSQL");
        createTable();
    }
});

// ─────────────────────────────────────────────
// GET / — Health check
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({ status: "ok", mensaje: "API El Punto de la Arepa 🚀" });
});

// ─────────────────────────────────────────────
// POST /pedido — Guardar nuevo pedido
// ─────────────────────────────────────────────
app.post("/pedido", async (req, res) => {
    const { nombre, telefono, email, direccion, items, total } = req.body;

    // ── Validación ──
    if (!nombre || !nombre.trim())
        return res.status(400).json({ ok: false, error: "El nombre es requerido" });
    if (!telefono || !telefono.trim())
        return res.status(400).json({ ok: false, error: "El teléfono es requerido" });
    if (!direccion || !direccion.trim())
        return res.status(400).json({ ok: false, error: "La dirección es requerida" });
    if (!items || !Array.isArray(items) || items.length === 0)
        return res.status(400).json({ ok: false, error: "El pedido está vacío" });
    if (!total || total <= 0)
        return res.status(400).json({ ok: false, error: "El total no es válido" });

    try {
        const result = await pool.query(
            `INSERT INTO pedidos (nombre, telefono, email, direccion, items, total, estado)
             VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
             RETURNING id`,
            [
                nombre.trim(),
                telefono.trim(),
                email ? email.trim() : null,
                direccion.trim(),
                JSON.stringify(items),
                total
            ]
        );

        const id = result.rows[0].id;
        console.log(`📦 Nuevo pedido #${id} — ${nombre} — $${total}`);
        res.json({ ok: true, id, mensaje: "Pedido guardado correctamente" });

    } catch (err) {
        console.error("Error guardando pedido:", err.message);
        res.status(500).json({ ok: false, error: "Error interno del servidor" });
    }
});

// ─────────────────────────────────────────────
// GET /pedidos — Ver todos los pedidos (admin)
// ─────────────────────────────────────────────
app.get("/pedidos", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM pedidos ORDER BY fecha DESC"
        );

        const pedidos = result.rows.map(row => ({
            ...row,
            items: JSON.parse(row.items)
        }));

        res.json({ ok: true, pedidos });

    } catch (err) {
        console.error("Error obteniendo pedidos:", err.message);
        res.status(500).json({ ok: false, error: "Error al obtener pedidos" });
    }
});

// ─────────────────────────────────────────────
// PATCH /pedido/:id/estado — Actualizar estado
// pendiente → en preparación → en camino → entregado
// ─────────────────────────────────────────────
app.patch("/pedido/:id/estado", async (req, res) => {
    const { id }     = req.params;
    const { estado } = req.body;

    const estadosValidos = ["pendiente", "en preparación", "en camino", "entregado", "cancelado"];

    if (!estadosValidos.includes(estado))
        return res.status(400).json({ ok: false, error: "Estado no válido" });

    try {
        const result = await pool.query(
            "UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING id",
            [estado, id]
        );

        if (result.rowCount === 0)
            return res.status(404).json({ ok: false, error: "Pedido no encontrado" });

        console.log(`✏️  Pedido #${id} → ${estado}`);
        res.json({ ok: true, mensaje: `Pedido #${id} actualizado a '${estado}'` });

    } catch (err) {
        console.error("Error actualizando estado:", err.message);
        res.status(500).json({ ok: false, error: "Error al actualizar" });
    }
});

// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
