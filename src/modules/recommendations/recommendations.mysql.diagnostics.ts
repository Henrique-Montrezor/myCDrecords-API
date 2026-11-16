import { createConnection } from "node:net";

export async function diagnoseMysqlEndpoint(env: NodeJS.ProcessEnv = process.env) {
    const host = env.MYSQL_HOST;
    const port = Number(env.MYSQL_PORT || 3306);
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("MYSQL_ENDPOINT_CONFIGURATION_INVALID");
    return new Promise<{ dnsResolved: boolean; tcpConnected: boolean; mysqlGreeting: boolean; code: string }>((resolve) => {
        let dnsResolved = false;
        let tcpConnected = false;
        let settled = false;
        const socket = createConnection({ host, port });
        const finish = (mysqlGreeting: boolean, code: string) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({ dnsResolved, tcpConnected, mysqlGreeting, code });
        };
        socket.setTimeout(5000, () => finish(false, tcpConnected ? "MYSQL_GREETING_TIMEOUT" : "MYSQL_TCP_TIMEOUT"));
        socket.once("lookup", (error) => { dnsResolved = !error; });
        socket.once("connect", () => { dnsResolved = true; tcpConnected = true; });
        let greeting = Buffer.alloc(0);
        socket.on("data", (chunk: Buffer) => {
            greeting = Buffer.concat([greeting, chunk.subarray(0, 5 - greeting.length)]);
            if (greeting.length >= 5) finish(greeting[4] === 10, greeting[4] === 10 ? "MYSQL_GREETING_RECEIVED" : "UNEXPECTED_SERVER_PROTOCOL");
        });
        socket.once("error", (error) => {
            const code = "code" in error && typeof error.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
                ? error.code : "MYSQL_NETWORK_ERROR";
            finish(false, code);
        });
        socket.once("end", () => finish(false, "MYSQL_CONNECTION_CLOSED"));
    });
}
