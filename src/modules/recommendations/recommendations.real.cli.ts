import { spawn } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { Pool } from "mysql2/promise";
import { buildRealExchange, readRealSnapshot, verifyRealSnapshot } from "./recommendations.real";

const metrics = z.object({ recall: z.number().finite().min(0).max(1), ndcg: z.number().finite().min(0).max(1) }).strict();
const windowMetrics = z.object({
    evaluatedUsers: z.number().int().positive(), coldUsers: z.number().int().nonnegative(),
    coldItems: z.number().int().nonnegative(), unavailableTargets: z.number().int().nonnegative(),
    model: metrics, baseline: metrics,
}).strict();
const realReportSchema = z.object({
    status: z.literal("trained"), mode: z.literal("real"), protocol: z.literal("real-global-time-60-20-20-bpr-v1"),
    users: z.number().int().min(2), albums: z.number().int().min(2), events: z.number().int().positive(),
    training: z.object({
        initialLoss: z.number().finite(), finalLoss: z.number().finite(), epochs: z.number().int().positive(),
        seed: z.number().int(), torchVersion: z.string().regex(/^[0-9a-zA-Z.+_-]{1,60}$/),
    }).strict(),
    validation: windowMetrics, test: windowMetrics, promotionAllowed: z.literal(false), persistedWeights: z.literal(false),
}).strict();
const blockedSchema = z.object({
    status: z.literal("blocked"), code: z.string().regex(/^[A-Z][A-Z0-9_]{0,80}$/),
    mode: z.literal("real"), promotionAllowed: z.literal(false),
}).strict();

export function runRealPython(exchange: ReturnType<typeof buildRealExchange>) {
    const directory = path.resolve(__dirname, "..", "..", "..", "..", "myCDrecords-ml");
    const python = path.join(directory, ".venv", process.platform === "win32" ? "Scripts" : "bin",
        process.platform === "win32" ? "python.exe" : "python");
    const payload = JSON.stringify(exchange);
    if (Buffer.byteLength(payload) > 2 * 1024 * 1024) throw new Error("EXCHANGE_TOO_LARGE");
    return new Promise<z.infer<typeof realReportSchema>>((resolve, reject) => {
        // The child receives only the closed exchange, not DB/provider credentials from the parent.
        const env: NodeJS.ProcessEnv = {
            PYTHONUTF8: "1", PYTHONNOUSERSITE: "1",
            SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR,
            PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP,
        };
        const child = spawn(python, ["-m", "mycdrecords_ml.real"], {
            cwd: directory, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], timeout: 120000,
        });
        let output = "";
        let overflow = false;
        child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
            if (Buffer.byteLength(output) + Buffer.byteLength(chunk) > 32768) {
                overflow = true;
                child.kill();
            } else output += chunk;
        });
        child.stderr.resume();
        child.on("error", () => reject(new Error("PYTHON_START_FAILED")));
        child.stdin.on("error", () => reject(new Error("PYTHON_INPUT_FAILED")));
        child.on("close", (code) => {
            if (overflow) { reject(new Error("PYTHON_OUTPUT_LIMIT")); return; }
            try {
                const result: unknown = JSON.parse(output);
                if (code !== 0) {
                    const blocked = blockedSchema.safeParse(result);
                    reject(new Error(blocked.success ? blocked.data.code : "PYTHON_TRAINING_FAILED"));
                    return;
                }
                resolve(realReportSchema.parse(result));
            } catch {
                reject(new Error("PYTHON_INVALID_RESULT"));
            }
        });
        child.stdin.end(payload);
    });
}

async function train(pool: Pool) {
    const connection = await pool.getConnection();
    try {
        const before = await readRealSnapshot(connection);
        const exchange = buildRealExchange(before);
        const report = await runRealPython(exchange);
        const after = await readRealSnapshot(connection);
        verifyRealSnapshot(before, after);
        return report;
    } finally {
        connection.release();
    }
}

async function saveResult(command: string, report: object) {
    const directory = path.resolve(__dirname, "..", "..", "..", "..", "myCDrecords-ml", "artifacts");
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, `${command}-real-result.json`);
    const pending = `${target}.${process.pid}.tmp`;
    await writeFile(pending, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    await rename(pending, target);
}

async function main(args: string[]) {
    if (args.length === 1 && args[0] === "--help") {
        console.log("mysql: homologa migrações/controles em schema novo isolado; não apaga o schema.");
        console.log("migrate: aplica somente migrações ML 008/009, aditivas, no banco configurado.");
        console.log("train: treina/avalia notas elegíveis localmente em memória, sem salvar pesos ou publicar recomendações.");
        console.log("diagnose: verifica DNS/TCP e saudação MySQL sem autenticar ou exibir o endpoint.");
        return;
    }
    if (args.length !== 1 || !["mysql", "migrate", "train", "diagnose"].includes(args[0])) throw new Error("INVALID_ARGUMENTS");
    const { getPool } = await import("../../mysql2/init.database");
    const pool = getPool();
    try {
        let report: object;
        if (args[0] === "diagnose") {
            const { diagnoseMysqlEndpoint } = await import("./recommendations.mysql.diagnostics");
            const diagnosis = await diagnoseMysqlEndpoint();
            report = { status: diagnosis.mysqlGreeting ? "reachable" : "blocked", mode: "mysql-diagnostics", ...diagnosis };
            if (!diagnosis.mysqlGreeting) process.exitCode = 1;
        } else if (args[0] === "mysql") {
            const { verifyPilotMysql } = await import("./recommendations.mysql.verify");
            report = await verifyPilotMysql(pool);
        } else if (args[0] === "migrate") {
            const { migrateMlPilotControls } = await import("../../mysql2/migrations/008-ml-pilot-controls");
            const { migrateMlPilotCollection } = await import("../../mysql2/migrations/009-ml-pilot-collection");
            const connection = await pool.getConnection();
            try {
                await migrateMlPilotControls(connection);
                await migrateMlPilotCollection(connection);
            } finally { connection.release(); }
            report = { status: "migrated", migrations: ["008", "009"], noticeVersion: "ml-pilot-v2" };
        } else {
            report = await train(pool);
        }
        await saveResult(args[0], report);
        console.log(JSON.stringify(report, null, 2));
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    void main(process.argv.slice(2)).catch(async (error: unknown) => {
        let code = "REAL_ML_OPERATION_FAILED";
        if (error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message)) code = error.message;
        if (error instanceof Error && "code" in error && typeof error.code === "string" && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.code)) {
            code = error.code;
        }
        const report = { status: "blocked", mode: "real", code, promotionAllowed: false };
        const command = process.argv[2];
        if (["mysql", "migrate", "train", "diagnose"].includes(command)) {
            try {
                await saveResult(command, report);
            } catch {
                console.error(JSON.stringify({ status: "blocked", code: "RESULT_PERSISTENCE_FAILED" }));
            }
        }
        console.error(JSON.stringify(report));
        process.exitCode = 1;
    });
}
