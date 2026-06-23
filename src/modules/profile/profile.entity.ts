export interface Profile {
    id: number;
    user_id: number;
    username: string;
    bio: string;
    avatar_url: string;
}

export interface CreateProfileParams {
    user_id: number;
    username?: string;
    bio: string;
    avatar_url: string;
}

export interface UsernameProfile {
    username: string;
}
