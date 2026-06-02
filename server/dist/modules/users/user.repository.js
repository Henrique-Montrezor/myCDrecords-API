"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.findByEmail = findByEmail;
exports.findByUsername = findByUsername;
exports.findById = findById;
exports.findByIdForResponse = findByIdForResponse;
const init_database_1 = require("../../mysql2/init.database");
async function createUser(user) {
    const connection = await (0, init_database_1.initDatabase)();
    const query = `
        INSERT INTO users
        (username, email, password, is_active)
        VALUES (?, ?, ?, true)
    `;
    const [result] = await connection.query(query, [
        user.username,
        user.email,
        user.password,
        user.is_active
    ]);
    // Return the created user with the ID
    return {
        id: result.insertId,
        username: user.username,
        email: user.email,
        is_active: user.is_active,
    };
}
async function findByEmail(email) {
    console.log("findByEmail - email:", email);
    const connection = await (0, init_database_1.initDatabase)();
    const [rows] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
}
async function findByUsername(username) {
    const connection = await (0, init_database_1.initDatabase)();
    const [rows] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
    // Add logic to pull the profile related to the user and return it as well
    return rows[0] || null;
}
async function findById(id) {
    const connection = await (0, init_database_1.initDatabase)();
    const [rows] = await connection.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
}
async function findByIdForResponse(id) {
    const connection = await (0, init_database_1.initDatabase)();
    const [rows] = await connection.query('SELECT id, username, email, is_active, email_verified FROM users WHERE id = ?', [id]);
    return rows[0] || null;
}
//# sourceMappingURL=user.repository.js.map