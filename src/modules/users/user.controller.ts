import { Request, Response } from "express";
import { z } from "zod";
import { findByEmail, findByUsername, searchUsersByUsername } from "./user.repository";

const searchUsersQuery = z.object({
    username: z.string().trim().min(2, "username must have at least 2 characters").max(50),
});

// GET /api/user/search-users?username=prefix
export async function searchUsers(req: Request, res: Response) {
    const { username } = searchUsersQuery.parse(req.query);
    res.status(200).json(await searchUsersByUsername(username));
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