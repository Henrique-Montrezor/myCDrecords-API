import axios from "axios";
import { cache } from "../../utils/cache";

const BASE_URL = "https://musicbrainz.org/ws/2";

const HEADERS = {
  "User-Agent": "MyCDRecords/1.0.0 (MyCDRecords@Zormont.com)",
  "Accept": "application/json"
};

export async function fetchMusicBrainz(endpoint: string, params: any = {}) {
  params.fmt = "json";

  const cacheKey = `${endpoint}-${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);

  if (cached) return cached;

  try {
    const response = await axios.get(`${BASE_URL}/${endpoint}`, {
      headers: HEADERS,
      params,
      timeout: 10000
    });

    cache.set(cacheKey, response.data);
    return response.data;

  } catch (error: any) {
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