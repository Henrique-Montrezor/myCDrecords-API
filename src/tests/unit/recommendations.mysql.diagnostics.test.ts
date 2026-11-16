import { createServer } from "node:net";
import { diagnoseMysqlEndpoint } from "../../modules/recommendations/recommendations.mysql.diagnostics";

it.each([true, false])("distinguishes a MySQL greeting from a TCP-only connection (%s)", async (greeting) => {
    const server = createServer((socket) => {
        if (greeting) {
            socket.write(Buffer.from([1, 0]));
            setImmediate(() => socket.end(Buffer.from([0, 0, 10])));
        } else socket.end();
    });
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Missing test socket.");
        const result = await diagnoseMysqlEndpoint({ MYSQL_HOST: "127.0.0.1", MYSQL_PORT: String(address.port) });
        expect(result).toEqual({
            dnsResolved: true, tcpConnected: true, mysqlGreeting: greeting,
            code: greeting ? "MYSQL_GREETING_RECEIVED" : "MYSQL_CONNECTION_CLOSED",
        });
        expect(JSON.stringify(result)).not.toContain("127.0.0.1");
    } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
});
