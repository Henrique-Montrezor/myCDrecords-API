export interface ReviewResponse {
    id: number;
    user_id: number;
    username: string;
    album_id: string;
    album_title: string;
    album_image?: string;
    album_artist?: string;
    rating: number;
    text?: string;
    created_at: Date;
}

export interface RatingDistribution {
    rating: number;
    count: number;
}
