export interface UserRegisterParams {
    username: string;
    email: string;
    password: string;
    is_active: boolean;
    publicReviewNoticeVersion?: string;
}