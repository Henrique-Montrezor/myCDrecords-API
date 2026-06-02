"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMusicBrainz = fetchMusicBrainz;
const axios_1 = __importDefault(require("axios"));
const cache_1 = require("../../utils/cache");
const BASE_URL = "https://musicbrainz.org/ws/2";
const HEADERS = {
    "User-Agent": "MyCDRecords/1.0.0 (MyCDRecords@Zormont.com)",
    "Accept": "application/json"
};
async function fetchMusicBrainz(endpoint, params = {}) {
    params.fmt = "json";
    const cacheKey = `${endpoint}-${JSON.stringify(params)}`;
    const cached = cache_1.cache.get(cacheKey);
    if (cached)
        return cached;
    try {
        const response = await axios_1.default.get(`${BASE_URL}/${endpoint}`, {
            headers: HEADERS,
            params,
            timeout: 10000
        });
        cache_1.cache.set(cacheKey, response.data);
        return response.data;
    }
    catch (error) {
        if (error.response) {
            throw {
                status: error.response.status,
                message: error.response.data
            };
        }
        throw {
            status: 500,
            message: error.message
        };
    }
}
//# sourceMappingURL=musicbrainz.service.js.map