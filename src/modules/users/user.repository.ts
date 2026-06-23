import { initDatabase } from "../../mysql2/init.database";
import { UserRegisterParams } from "./user.entity";
import { RowDataPacket } from "mysql2";

export async function createUser(user: UserRegisterParams) {
    const connection = await initDatabase();
    const query = `
        INSERT INTO users
        (username, email, password, is_active)
        VALUES (?, ?, ?, true)
    `;
    const [result] = await connection.query<any>(query, [
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

export async function findByEmail(email: string) {
    console.log("findByEmail - email:", email);
    
    const connection = await initDatabase();

    const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM users WHERE email = ?',
        [email]
    );

    return rows[0] || null;
}

export async function findByUsername(username: string) {
    
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM users WHERE username = ?',
        [username]
    );

    // Add logic to pull the profile related to the user and return it as well

    return rows[0] || null;
}

export async function findById(id: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM users WHERE id = ?',
        [id]
    );

    return rows[0] || null;
}

export async function findByIdForResponse(id: number) {
    const connection = await initDatabase();
    const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT id, username, email, is_active, email_verified FROM users WHERE id = ?',
        [id]
    );

    return rows[0] || null;
}