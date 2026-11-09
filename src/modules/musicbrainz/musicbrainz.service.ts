import axios from "axios";
import { cache } from "../../utils/cache";

const BASE_URL = "https://musicbrainz.org/ws/2";

const HEADERS = {
  "User-Agent": "MyCDRecords/1.0.0 (MyCDRecords@Zormont.com)",
  "Accept": "application/json"
};

// MusicBrainz allows ~1 request/second per IP and answers 503 above that.
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_SECONDS = 3600;
const MAX_RETRY_WAIT_MS = 5000;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
const inFlight = new Map<string, Promise<unknown>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

function retryDelay(error: any) {
  const seconds = Number(error.response?.headers?.["retry-after"]);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, MAX_RETRY_WAIT_MS) : MIN_INTERVAL_MS;
}

async function request(endpoint: string, params: any) {
  const get = () => axios.get(`${BASE_URL}/${endpoint}`, { headers: HEADERS, params, timeout: 10000 });
  try {
    return (await throttled(get)).data;
  } catch (error: any) {
    if (error.response?.status !== 503) throw error;
    await sleep(retryDelay(error));
    return (await throttled(get)).data;
  }
}

export async function fetchMusicBrainz(endpoint: string, params: any = {}) {
  params.fmt = "json";

  const cacheKey = `${endpoint}-${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);

  if (cached) return cached;

  // Identical concurrent calls share one upstream request.
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const data = await request(endpoint, params);
      cache.set(cacheKey, data, CACHE_TTL_SECONDS);
      return data;
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
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, promise);
  return promise;
}