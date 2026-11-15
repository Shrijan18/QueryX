import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
    }
    : {
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: Number(process.env.PG_PORT) || 5432,
        max: 10,
    };

const db = new pg.Pool(poolConfig);

db.on("connect", () => {
    console.log("PostgreSQL connection established.");
});

db.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err);
});

export default db;
