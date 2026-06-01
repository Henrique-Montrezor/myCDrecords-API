import { Request, Response } from "express";
import { UserRegisterParams } from "./user.entity";
import { createUser, findByEmail, findByUsername } from "./user.repository";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function RegisterUser(req: Request, res: Response) {
    const { username, email, password }: UserRegisterParams = req.body;

    // Check if the <email> is already registered
    const existingUser = await findByEmail(email);

    if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
    }

    // Check if the <username> is already taken
    const existingUsername = await findByUsername(username);

    if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
    }

    // Register the user in the database
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await createUser({ username, email, password: hashedPassword, is_active: true } as UserRegisterParams);

        res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// searchUsers function
export async function searchUsers(req: Request, res: Response) {
    const { username } = req.query;

    const search = await findByUsername(username as string);
    if (!search) {
        return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(search);
}

// validateEmail function
export async function validateEmail(req: Request, res: Response) {
    const { email } = req.query;

    const search = await findByEmail(email as string);
    if (search) {
        return res.status(400).json({ message: "Email already registered" });
    }

    res.status(200).json({ message: "Email is available" });
}

export async function validateUsername(req: Request, res: Response) {
    const { username } = req.query;

    const search = await findByUsername(username as string);
    if (search) {
        return res.status(400).json({ message: "Username already taken" });
    }

    res.status(200).json({ message: "Username is available" });
}

// loginUser function
export async function loginUser(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
    }

    try {
        const user = await findByEmail(email);

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Compares the provided password with the hashed password in the database
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Senha incorreta" });
        }

        // Generate JWT
        const token = jwt.sign(
            { user_id: user.id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            { expiresIn: "7d" }
        );

        // sends the token as an HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true,      // Não acessível por JavaScript (seguro)
            secure: process.env.NODE_ENV === 'production', // Apenas HTTPS em produção
            sameSite: "strict",  // Proteção contra CSRF
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
        });

        res.status(200).json({
            message: "Login realizado com sucesso",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        res.status(500).json({ message: "Erro interno do servidor" });
    }
}

export async function logoutUser(req: Request, res: Response) {
    res.clearCookie("token");
    res.status(200).json({ message: "Logout realizado com sucesso" });
}