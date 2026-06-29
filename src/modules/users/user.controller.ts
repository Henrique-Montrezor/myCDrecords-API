import { Request, Response } from "express";
import { findByEmail, findByUsername } from "./user.repository";

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