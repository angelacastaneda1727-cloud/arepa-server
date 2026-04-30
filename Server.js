// ─────────────────────────────────────────────
// Server.js — El Punto de la Arepa
// ─────────────────────────────────────────────
const express = require("express");
const mysql   = require("mysql2");
const cors    = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// CONEXIÓN A MySQL con reconexión automática
// ─────────────────────────────────────────────
function createConnection() {
    const db = mysql.createConnection({
        host:     process.env.DB_HOST,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port:     process.env.DB_PORT || 3306
    });

    db.connect((err) => {
        if (err) {
            console.error("Error conectando a MySQL:", err.message);
            // Reintenta en 5 segundos si falla al arrancar
            setTimeout(createConnection, 5000);
        } else {
            console.log("✅ Conectado a MySQL");
            createTable(db);
        }
    });

    // Reconexión automática si se cae en medio del uso
    db.on("error", (err) => {
        console.error("Error de MySQL:", err.message);
        if (err.code === "PROTOCOL_CONNECTION_LOST") {
            console.log("Reconectando...");
            createConnection();
        } else {
            throw err;
        }
    });

    return db;
}

// ─────────────────────────────────────────────
// CREAR TABLA si no existe
// ✅ Incluye los campos nuevos: nombre, telefono, email
// ─────────────────────────────────────────────
function createTable(db) {
    const sql = `
        CREATE TABLE IF NOT EXISTS pedidos (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            nombre     VARCHAR(100)  NOT NULL,
            telefono   VARCHAR(20)   NOT NULL,
            email      VARCHAR(100),
            direccion  TEXT          NOT NULL,
            items      TEXT          NOT NULL,
            total      INT           NOT NULL,
            estado     VARCHAR(50)   DEFAULT 'pendiente',
            fecha      DATETIME      DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.query(sql, (err) => {
        if (err) console.error("Error creando tabla:", err.message);
        else     console.log("✅ Tabla 'pedidos' lista");
    });
}

const db = createConnection();

// ─────────────────────────────────────────────
// GET / — Health check
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({ status: "ok", mensaje: "API El Punto de la Arepa 🚀" });
});

// ─────────────────────────────────────────────
// POST /pedido — Guardar nuevo pedido
// ✅ Ahora recibe: nombre, telefono, email, direccion, items, total
// ─────────────────────────────────────────────
app.post("/pedido", (req, res) => {
    const { nombre, telefono, email, direccion, items, total } = req.body;

    // ── Validación básica ──
    if (!nombre || !nombre.trim()) {
        return res.status(400).json({ ok: false, error: "El nombre es requerido" });
    }
    if (!telefono || !telefono.trim()) {
        return res.status(400).json({ ok: false, error: "El teléfono es requerido" });
    }
    if (!direccion || !direccion.trim()) {
        return res.status(400).json({ ok: false, error: "La dirección es requerida" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ ok: false, error: "El pedido está vacío" });
    }
    if (!total || total <= 0) {
        return res.status(400).json({ ok: false, error: "El total no es válido" });
    }

    const sql = `
        INSERT INTO pedidos (nombre, telefono, email, direccion, items, total, estado)
        VALUES (?, ?, ?, ?, ?, ?, 'pendiente')
    `;

    db.query(
        sql,
        [
            nombre.trim(),
            telefono.trim(),
            email ? email.trim() : null,
            direccion.trim(),
            JSON.stringify(items),
            total
        ],
        (err, result) => {
            if (err) {
                console.error("Error guardando pedido:", err.message);
                return res.status(500).json({ ok: false, error: "Error interno del servidor" });
            }

            console.log(`📦 Nuevo pedido #${result.insertId} — ${nombre} — $${total}`);

            res.json({
                ok: true,
                id: result.insertId,
                mensaje: "Pedido guardado correctamente"
            });
        }
    );
});

// ─────────────────────────────────────────────
// GET /pedidos — Ver todos los pedidos (para admin)
// ─────────────────────────────────────────────
app.get("/pedidos", (req, res) => {
    const sql = "SELECT * FROM pedidos ORDER BY fecha DESC";

    db.query(sql, (err, rows) => {
        if (err) {
            console.error("Error obteniendo pedidos:", err.message);
            return res.status(500).json({ ok: false, error: "Error al obtener pedidos" });
        }

        // Parsear el JSON de items antes de enviar
        const pedidos = rows.map(row => ({
            ...row,
            items: JSON.parse(row.items)
        }));

        res.json({ ok: true, pedidos });
    });
});

// ─────────────────────────────────────────────
// PATCH /pedido/:id/estado — Actualizar estado
// Ej: pendiente → en preparación → entregado
// ─────────────────────────────────────────────
app.patch("/pedido/:id/estado", (req, res) => {
    const { id }     = req.params;
    const { estado } = req.body;

    const estadosValidos = ["pendiente", "en preparación", "en camino", "entregado", "cancelado"];

    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ ok: false, error: "Estado no válido" });
    }

    const sql = "UPDATE pedidos SET estado = ? WHERE id = ?";

    db.query(sql, [estado, id], (err, result) => {
        if (err) {
            console.error("Error actualizando estado:", err.message);
            return res.status(500).json({ ok: false, error: "Error al actualizar" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ ok: false, error: "Pedido no encontrado" });
        }

        console.log(`✏️  Pedido #${id} → ${estado}`);
        res.json({ ok: true, mensaje: `Pedido #${id} actualizado a '${estado}'` });
    });
});

// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
